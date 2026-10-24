#!/usr/bin/env python3
"""Exercise the packaged Linux UI through Tauri's native WebKit WebDriver."""
import argparse
import base64
import json
import os
from pathlib import Path
import subprocess
import tempfile
import time
import urllib.error
import urllib.request


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--binary', required=True)
    parser.add_argument('--output', required=True)
    parser.add_argument('--driver', default='tauri-driver')
    args = parser.parse_args()
    output = Path(args.output).resolve()
    output.mkdir(parents=True, exist_ok=True)
    endpoint = 'http://127.0.0.1:4444'

    def request(method, route, data=None):
        body = None if data is None else json.dumps(data).encode()
        req = urllib.request.Request(endpoint + route, data=body, method=method,
                                     headers={'Content-Type': 'application/json'})
        try:
            with urllib.request.urlopen(req, timeout=45) as response:
                result = json.load(response)
        except urllib.error.HTTPError as error:
            raise RuntimeError(error.read().decode()) from error
        value = result.get('value')
        if isinstance(value, dict) and value.get('error'):
            raise RuntimeError(json.dumps(value))
        return value

    def wait_until(call, timeout=30):
        end = time.monotonic() + timeout
        last = None
        while time.monotonic() < end:
            try:
                result = call()
                if result:
                    return result
            except (OSError, RuntimeError) as error:
                last = error
            time.sleep(.15)
        raise AssertionError(f'Native UI condition timed out: {last}')

    with tempfile.TemporaryDirectory(prefix='renderift-native-test-') as private:
        env = {**os.environ, 'XDG_DATA_HOME': private + '/data',
               'XDG_CONFIG_HOME': private + '/config', 'XDG_CACHE_HOME': private + '/cache',
               'LIBGL_ALWAYS_SOFTWARE': '1'}
        with (output / 'webdriver.log').open('w') as log:
            driver = subprocess.Popen([args.driver, '--native-driver', 'WebKitWebDriver'],
                                      stdout=log, stderr=subprocess.STDOUT, env=env)
            session = None
            try:
                wait_until(lambda: request('GET', '/status'))
                start = time.monotonic()
                value = request('POST', '/session', {'capabilities': {'alwaysMatch': {
                    'tauri:options': {'application': str(Path(args.binary).resolve())}}}})
                session = value['sessionId']
                prefix = '/session/' + session

                def script(source):
                    return request('POST', prefix + '/execute/sync', {'script': source, 'args': []})

                def async_script(source):
                    return request('POST', prefix + '/execute/async', {'script': source, 'args': []})

                wait_until(lambda: script("return !!document.querySelector('.cm-content')"))
                startup_ms = round((time.monotonic() - start) * 1000)
                title = script('return document.title')
                assert 'Renderift' in title, title
                authorized = async_script("""
                    const done=arguments[arguments.length-1];
                    window.__TAURI_INTERNALS__.invoke('dispatch',{
                      op:'poll',args:{},token:window.__RENDERIFT_NATIVE_TOKEN__
                    }).then(()=>done(true)).catch(e=>done(String(e)));
                """)
                assert authorized is True, authorized
                denied = async_script("""
                    const done=arguments[arguments.length-1];
                    window.__TAURI_INTERNALS__.invoke('dispatch',{
                      op:'poll',args:{},token:'forged'
                    }).then(()=>done(false)).catch(e=>done(String(e)));
                """)
                assert 'Native access denied' in denied, denied
                frame = wait_until(lambda: request('POST', prefix + '/element',
                                                   {'using': 'css selector', 'value': 'iframe'}))
                request('POST', prefix + '/frame', {'id': frame})
                wait_until(lambda: script('return !!document.querySelector("h1")'))
                boundary = script("""
                    let denied=false;try{parent.document.body;}catch{denied=true;}
                    return {parentDenied:denied,token:typeof window.__RENDERIFT_NATIVE_TOKEN__,
                            heading:document.querySelector('h1').textContent};
                """)
                assert boundary['parentDenied'], boundary
                assert boundary['token'] == 'undefined', boundary
                assert 'Make something' in boundary['heading'], boundary
                script("document.querySelector('#create').click()")
                wait_until(lambda: script("return document.querySelector('h1').textContent.includes('already')"))
                request('POST', prefix + '/frame', {'id': None})
                wait_until(lambda: script("return document.querySelector('.console-message')?.textContent.includes('taking shape')"))
                screenshot = request('GET', prefix + '/screenshot')
                (output / 'linux-desktop.png').write_bytes(base64.b64decode(screenshot))
                report = {'status': 'passed', 'title': title,
                          'ui_ready_after_webdriver_session_ms': startup_ms,
                          'native_authenticated_call': True, 'forged_native_call_denied': True,
                          'iframe_parent_access_denied': True, 'iframe_native_token_absent': True,
                          'preview_interaction_and_console': True,
                          'note': 'Virtual-display WebKitGTK integration, not a clean desktop installation benchmark.'}
                (output / 'SMOKE-Linux-x64.json').write_text(json.dumps(report, indent=2) + '\n')
                print(json.dumps(report, indent=2))
            finally:
                if session:
                    try:
                        request('DELETE', '/session/' + session)
                    except (OSError, RuntimeError):
                        pass
                driver.terminate()
                try:
                    driver.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    driver.kill()
                    driver.wait()


if __name__ == '__main__':
    main()
