<script setup>import{ref}from'vue';const count=ref(0);</script>
<template><main><p>VUE + VITE</p><h1>Ideas, in motion.</h1><button @click="count++">Count: {{count}}</button><p dir="rtl">سلام دنیا</p></main></template>
<style>body{background:#eef3e9;color:#244b3b;font:18px system-ui}main{padding:10%}h1{font-weight:500}button{padding:12px 22px;background:#244b3b;color:white;border:0;border-radius:6px;cursor:pointer}p{font-size:12px;letter-spacing:1px}</style>
