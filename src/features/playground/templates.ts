import type { Playground } from '../../shared/types';
export type Template = Pick<Playground, 'name' | 'html' | 'css' | 'js'>;
export const templates: Template[] = [
  {
    name: 'First light',
    html: `<main class="studio">
  <div class="eyebrow"><span></span> A LITTLE SPACE TO CREATE</div>
  <h1>Make something<br><em>worth seeing.</em></h1>
  <p>A thought, a few lines of code, a new possibility.<br>Your next idea starts right here.</p>
  <button id="create">Let’s make it happen <span>↗</span></button>
  <div class="note">01 / YOUR CANVAS IS READY</div>
</main>`,
    css: `* { box-sizing: border-box; }
body { margin: 0; background: #f4f2ec; color: #202c29; font-family: system-ui, sans-serif; }
.studio { padding: 12% 9%; min-height: 100vh; background: radial-gradient(ellipse at 100% 0%, #cde6d2 0, transparent 60%); }
.eyebrow { font-size: 10px; letter-spacing: 2px; display: flex; align-items: center; gap: 9px; }
.eyebrow span { width: 7px; height: 7px; border-radius: 50%; background: #30845f; }
h1 { font-size: clamp(36px, 5.5vw, 76px); line-height: 1.08; letter-spacing: -3px; font-weight: 500; margin: 55px 0 25px; }
h1 em { font-family: Georgia, serif; font-weight: 400; color: #35785d; }
p { color: #63716a; font-size: 14px; line-height: 1.8; }
button { margin-top: 22px; background: #244b3d; border: 0; border-radius: 5px; color: white; padding: 15px 20px; cursor: pointer; }
button span { margin-left: 28px; }
.note { margin-top: 70px; font-size: 9px; letter-spacing: 2px; color: #74857a; }
@media (max-width: 400px) { h1 { letter-spacing: -1px; } }`,
    js: `document.querySelector('#create').addEventListener('click', () => {
  document.querySelector('h1').innerHTML = 'You’ve already<br><em>started.</em>';
  console.log('A new idea is taking shape.');
});`,
  },
  {
    name: 'Interactive buttons',
    html: '<main><h1>Small interactions.</h1><button id="counter">Clicked 0 times</button><button id="theme">Switch color</button></main>',
    css: 'body{font:18px system-ui;background:#eff6f1;color:#214737}main{padding:15% 8%}button{background:#245c46;color:white;border:0;border-radius:8px;padding:16px;margin:8px;cursor:pointer}button:hover{transform:translateY(-2px)}',
    js: 'let n=0;document.querySelector("#counter").onclick=e=>e.target.textContent=`Clicked ${++n} times`;document.querySelector("#theme").onclick=()=>document.body.style.background=`hsl(${Math.random()*360} 45% 90%)`;',
  },
  {
    name: 'CSS motion',
    html: '<main><div class="orbit"><i></i></div><h1>Stay in motion.</h1></main>',
    css: 'body{margin:0;background:#172033;color:#65e6bb;font:20px system-ui}main{display:grid;place-content:center;min-height:100vh;text-align:center}.orbit{width:150px;height:150px;border:1px solid #65e6bb;border-radius:50%;margin:auto;animation:spin 6s linear infinite}.orbit i{display:block;background:#65e6bb;width:25px;height:25px;border-radius:50%;margin:10px}@keyframes spin{to{transform:rotate(360deg)}}@media(prefers-reduced-motion:reduce){.orbit{animation:none}}',
    js: '',
  },
  {
    name: 'Flex & Grid',
    html: '<main><h1>A place for everything.</h1><section><article>01<br>Explore</article><article>02<br>Imagine</article><article>03<br>Create</article><article>04<br>Repeat</article></section></main>',
    css: 'body{background:#eeeae1;color:#263a31;font:24px system-ui;margin:0}main{padding:8%}section{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:16px}article{display:flex;align-items:center;justify-content:center;border:1px solid #8ba798;min-height:180px;border-radius:8px;background:#dbe8dc}',
    js: '',
  },
  {
    name: 'DOM playground',
    html: '<main><h1>What’s on your mind?</h1><form><label>New note <input required placeholder="An idea…"></label><button>Add</button></form><ul></ul></main>',
    css: 'body{background:#f6f3eb;color:#294335;font:18px system-ui}main{padding:8%}input,button{padding:12px;border:1px solid #749684;border-radius:6px;margin:4px}li{padding:10px;cursor:pointer}li:hover{text-decoration:line-through}',
    js: 'document.querySelector("form").onsubmit=e=>{e.preventDefault();const input=document.querySelector("input");const item=document.createElement("li");item.textContent=input.value;item.onclick=()=>item.remove();document.querySelector("ul").append(item);input.value="";console.info("Note added")};',
  },
  {
    name: 'Form validation',
    html: '<main><h1>Keep in touch.</h1><form><label>Email <input type="email" required placeholder="you@example.com"></label><button>Subscribe</button><p role="status"></p></form></main>',
    css: 'body{font:18px system-ui;background:#e5f0e9;color:#234d3a}main{padding:10%}label{display:flex;flex-direction:column;gap:8px;max-width:300px}input,button{padding:13px;border-radius:6px;border:1px solid #578a6d;margin-top:12px}button{background:#234d3a;color:white;cursor:pointer}',
    js: 'document.querySelector("form").onsubmit=e=>{e.preventDefault();document.querySelector("[role=status]").textContent="Thanks! This offline example does not send any data.";console.log("Form validated")};',
  },
];
export function makePlayground(template: Template = templates[0]): Playground {
  return { ...template, id: crypto.randomUUID() };
}
