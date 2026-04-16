import{a as e}from"./rolldown-runtime-B589uzA9.js";import{r as t}from"./vendor-charts-DO53rMkR.js";import{H as n}from"./vendor-markdown-DGpJprFw.js";import"./vendor-utils-D2Wf7oYX.js";import{n as r}from"./sanitizer.frontend-aQSqRUSJ.js";var i=e(t(),1),a=n(),o=e=>e?e.replace(/<\/?style\b[^>]*>/gi,``).replace(/<\/?script\b[^>]*>/gi,``).trim():``,s=({stylesheet:e,headerContent:t,templateContent:n,footerContent:s,title:c=`Template preview`,className:l=`w-full h-full border-0 bg-white`,scale:u=1})=>(0,a.jsx)(`iframe`,{title:c,srcDoc:(0,i.useMemo)(()=>{let i=o(e),a=r(t),c=r(n),l=r(s),d=Number.isFinite(u)&&u>0?u:1,f=d===1?`100%`:`${100/d}%`;return`<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
      html, body {
        margin: 0;
        padding: 0;
        background: #ffffff;
      }
      body {
        min-height: 100vh;
      }
      #template-preview-root {
        ${d===1?`min-height:100%;`:`transform:scale(${d});transform-origin:top left;width:${f};min-height:${100/d}%;`}
      }
      ${i}
    </style>
  </head>
  <body>
    <div id="template-preview-root">
      ${a}
      ${c}
      ${l}
    </div>
  </body>
</html>`},[s,t,u,e,n]),className:l,sandbox:`allow-same-origin`,referrerPolicy:`no-referrer`});export{s as default};
//# sourceMappingURL=TemplatePreviewFrame-0fk9HnOr.js.map