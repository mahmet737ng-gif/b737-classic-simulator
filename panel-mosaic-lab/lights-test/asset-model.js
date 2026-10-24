(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.B737LightAssets=api;})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const order=['OFF','ON','DIM_BLUE','BRIGHT_BLUE'];
 function parse(name){const m=/^(.*?)_(BRIGHT_BLUE|DIM_BLUE|ON|OFF)\.(PNG|SVG|WEBP|JPE?G)$/i.exec(name);return m?{id:m[1].toUpperCase(),state:m[2].toUpperCase(),ext:m[3].toLowerCase(),name}:null;}
 function discover(list){const found={};for(const f of list){if(f.type!=='file')continue;const a=parse(f.name);if(!a)continue;const previous=found[a.id]?.[a.state],score=x=>({png:4,svg:3,webp:2,jpg:1,jpeg:1}[x.ext]||0);if(!previous||score(a)>score(previous)){found[a.id]??={};found[a.id][a.state]=a;}}return found;}
 function merge(registry,list=[]){const groups=discover(list),all=new Map(registry.lights.map(c=>[c.id,{...c,assets:{...c.assets}}]));for(const [id,files]of Object.entries(groups)){const c=all.get(id)||{id,lines:[id.replaceAll('_',' ')],scope:'ASSET_TEST_ONLY',face:{width:600,height:300},assets:{}};for(const [s,f]of Object.entries(files))c.assets[s]=f.name;c.states=order.filter(s=>c.assets[s]);all.set(id,c);}return [...all.values()];}
 function normalize(c,value){if(typeof value==='boolean')return value?c.states.at(-1):'OFF';return typeof value==='string'&&c.states.includes(value.toUpperCase())?value.toUpperCase():null;}
 return Object.freeze({parse,discover,merge,normalize});
});
