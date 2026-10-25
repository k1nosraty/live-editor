#!/usr/bin/env python3
"""Exercise the packaged Linux UI through Tauri's native WebKit WebDriver."""
import argparse
import json
import os
import shutil
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
    native_driver = shutil.which('WebKitWebDriver')
    if not native_driver:
        raise RuntimeError('WebKitWebDriver is missing. Install webkit2gtk-driver first.')
    screenshot_tool = shutil.which('scrot')
    if not screenshot_tool:
        raise RuntimeError('scrot is missing. Install it to capture the Xvfb desktop.')

    def request(method, route, data=None, timeout=45):
        body = None if data is None else json.dumps(data).encode()
        req = urllib.request.Request(endpoint + route, data=body, method=method,
                                     headers={'Content-Type': 'application/json'})
        try:
            with urllib.request.urlopen(req, timeout=timeout) as response:
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

    with tempfile.TemporaryDirectory(prefix='live-editor-native-test-') as private:
        env = {**os.environ, 'XDG_DATA_HOME': private + '/data',
               'XDG_CONFIG_HOME': private + '/config', 'XDG_CACHE_HOME': private + '/cache',
               'LIBGL_ALWAYS_SOFTWARE': '1', 'WEBKIT_DISABLE_DMABUF_RENDERER': '1',
               'WEBKIT_DISABLE_COMPOSITING_MODE': '1'}
        with (output / 'webdriver.log').open('w') as log:
            driver = subprocess.Popen([args.driver, '--native-driver', native_driver],
                                      stdout=log, stderr=subprocess.STDOUT, env=env)
            session = None
            try:
                def driver_ready():
                    if driver.poll() is not None:
                        log.flush()
                        raise AssertionError('tauri-driver exited before startup:\n' +
                                             (output / 'webdriver.log').read_text())
                    return request('GET', '/status')

                wait_until(driver_ready)
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
                assert 'Live Editor' in title, title
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
                state = script("""
                    const f=document.querySelector('iframe');
                    return {title:document.title,origin:location.origin,userAgent:navigator.userAgent,
                            frame:f?{src:f.src,sandbox:f.sandbox.value,ready:f.dataset.ready}:null,
                            text:document.body.innerText.slice(-3000)};
                """)
                if state['frame']:
                    with urllib.request.urlopen(state['frame']['src'], timeout=10) as response:
                        html = response.read().decode()
                        state['preview_http'] = {'status': response.status, 'bytes': len(html),
                                                 'has_heading': 'Make something' in html}
                (output / 'native-preview-state.json').write_text(json.dumps(state, indent=2) + '\n')
                # Wait for the actual preview bridge before selecting its browsing context.
                # WebKit may otherwise keep WebDriver in the initial about:blank document.
                wait_until(lambda: script('return document.querySelector("iframe")?.dataset.ready === "true"'))
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
                # WebKit's screenshot endpoint hangs with the opaque iframe; capture Xvfb directly.
                time.sleep(.2)
                subprocess.run([screenshot_tool, '-o', str(output / 'linux-desktop.png')],
                               env=env, check=True, timeout=10)
                report = {'status': 'passed', 'title': title,
                          'ui_ready_after_webdriver_session_ms': startup_ms,
                          'native_authenticated_call': True, 'forged_native_call_denied': True,
                          'iframe_parent_access_denied': True, 'iframe_native_token_absent': True,
                          'preview_interaction_and_console': True,
                          'screenshot_state': 'Xvfb desktop after preview interaction and console verification.',
                          'note': 'Virtual-display WebKitGTK integration, not a clean desktop installation benchmark.'}
                (output / 'SMOKE-Linux-x64.json').write_text(json.dumps(report, indent=2) + '\n')
                print(json.dumps(report, indent=2))
            except Exception:
                log.flush()
                print((output / 'webdriver.log').read_text())
                if session:
                    try:
                        subprocess.run([screenshot_tool, '-o', str(output / 'linux-failure.png')],
                                       env=env, check=True, timeout=10)
                    except (OSError, subprocess.SubprocessError):
                        pass
                raise
            finally:
                if session:
                    try:
                        request('DELETE', '/session/' + session, timeout=10)
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
