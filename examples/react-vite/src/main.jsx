import React,{useState} from 'react';import{createRoot}from'react-dom/client';import './style.css';
function App(){const[count,setCount]=useState(0);return <main><p>REACT + VITE</p><h1>A new perspective.</h1><button onClick={()=>setCount(count+1)}>Count: {count}</button><p dir="rtl">سلام دنیا</p></main>}createRoot(document.getElementById('root')).render(<App/>);
