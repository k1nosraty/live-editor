import { greeting } from './shared.js';
console.log(greeting);
let n=0;document.querySelector('#count').onclick=e=>{e.target.textContent=`Count: ${++n}`;console.info('Counter',n);};
