import{d as ot,j as g,b as nt,o as lt,H as it,c as d,e as t,g as y,f as b,h as D,w as K,v as P,t as o,q as w,F as L,r as O,x as rt,K as N,k,z as dt,n as ut,l as u}from"./index-BGNIbHHd.js";import{F as I}from"./file-text-xOkd3WaH.js";import{P as Y}from"./printer-CYkLcITl.js";import{X as ct}from"./x-MuqVu3h1.js";import{C as U}from"./calendar-Da5Dm18k.js";import{S as vt}from"./send-BFgMDIsG.js";import{_ as pt}from"./_plugin-vue_export-helper-DnafTyV7.js";const mt={class:"page"},ht={class:"page-head"},gt={class:"head-actions no-print"},yt={class:"date-nav no-print"},bt=["disabled"],ft={class:"print-header print-only"},_t={class:"stats-grid"},kt={class:"stat-card stat-card--main"},Dt={class:"stat-val money"},wt={class:"stat-sub"},St={class:"stat-card"},Tt={class:"stat-val"},xt={class:"stat-sub"},$t={class:"stat-card"},Ct={class:"stat-val"},At={class:"stat-sub"},Mt={class:"stat-card"},jt={class:"stat-val"},Ft={key:0,class:"k-empty"},zt={key:1,class:"sections"},Rt={class:"section k-card"},Kt={class:"products-list"},Pt={class:"product-rank"},Lt={class:"product-name"},Ot={class:"product-qty mono"},Bt={class:"product-bar-wrap"},Et={class:"product-revenue mono"},Vt={class:"section k-card"},qt={class:"orders-table"},Nt={class:"mono"},It={class:"mono money"},Yt={class:"modal"},Ut={class:"modal-head"},Zt={class:"head-title"},Jt={class:"head-icon"},Gt={class:"modal-body"},Ht={class:"date-range"},Wt={class:"field"},Xt={class:"field"},Qt=["disabled"],te={key:0,class:"form-error"},ee={key:1,class:"monthly-report",id:"monthly-report"},se={class:"report-summary"},ae={class:"summary-card"},oe={class:"summary-val money"},ne={class:"summary-card"},le={class:"summary-val"},ie={class:"summary-card"},re={class:"summary-val"},de={class:"monthly-table"},ue={class:"mono"},ce={class:"dim"},ve={class:"ta-right mono money"},pe={class:"ta-right mono"},me={class:"ta-right mono"},he={class:"ta-right mono money"},ge={class:"ta-right mono"},ye={class:"ta-right mono"},be={key:0,class:"modal-foot"},fe=ot({__name:"ReportsView",setup(_e){function $(){const s=new Date,e=s.getFullYear(),a=String(s.getMonth()+1).padStart(2,"0"),l=String(s.getDate()).padStart(2,"0");return`${e}-${a}-${l}`}const i=g($()),f=g(null),B=nt(),C=g(!1),p=g(""),m=g(""),T=g(!1),c=g([]),_=g(null);function n(s){return"€ "+(s/100).toFixed(2)}async function E(){f.value=await N.get(`/reports/z-report?date=${i.value}`)}lt(E),it(i,E);const r=k(()=>{var s;return((s=f.value)==null?void 0:s.orders)??[]}),x=k(()=>{var s;return((s=f.value)==null?void 0:s.totalRevenue)??0}),V=k(()=>{var s;return((s=f.value)==null?void 0:s.cashTotal)??0}),q=k(()=>{var s;return((s=f.value)==null?void 0:s.cardTotal)??0}),A=k(()=>{var s;return((s=f.value)==null?void 0:s.topProducts)??[]});function M(s){return new Date(s+"T12:00:00").toLocaleDateString("sq-AL",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}function Z(s){return s?new Date(s).toLocaleTimeString("sq-AL",{hour:"2-digit",minute:"2-digit"}):"—"}function J(){const s=new Date(i.value+"T12:00:00");s.setDate(s.getDate()-1);const e=s.getFullYear(),a=String(s.getMonth()+1).padStart(2,"0"),l=String(s.getDate()).padStart(2,"0");i.value=`${e}-${a}-${l}`}function G(){const s=new Date(i.value+"T12:00:00");s.setDate(s.getDate()+1);const e=s.getFullYear(),a=String(s.getMonth()+1).padStart(2,"0"),l=String(s.getDate()).padStart(2,"0"),h=`${e}-${a}-${l}`;h<=$()&&(i.value=h)}const H=k(()=>i.value===$());function W(){if(!f.value)return;const s=window.open("","_blank","width=900,height=1100");if(!s){alert("Ju lutem lejoni pop-up-et për të printuar.");return}const e=r.value.filter(R=>R.paymentMethod==="cash").length,a=r.value.filter(R=>R.paymentMethod==="card").length,l=r.value.length?Math.round(x.value/r.value.length):0,at=`<!DOCTYPE html>
<html>
<head>
  <title>Z-Report ${i.value}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Inter", sans-serif;
      padding: 40px 50px;
      color: #6B7280;
      background: white;
      margin: 0;
    }
    .eyebrow {
      font-size: 11px;
      font-family: monospace;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: #9CA3AF;
      margin-bottom: 6px;
    }
    h1 {
      font-size: 32px;
      font-weight: 700;
      letter-spacing: -0.02em;
      margin: 0 0 32px;
      color: #6B7280;
    }
    .subtitle {
      font-size: 20px;
      font-weight: 700;
      color: #374151;
      margin-bottom: 4px;
    }
    .date {
      font-size: 14px;
      color: #9CA3AF;
      margin-bottom: 32px;
    }
    .stat-card {
      border: 1px solid #E5E7EB;
      border-radius: 12px;
      padding: 26px 30px;
      margin-bottom: 20px;
      background: white;
    }
    .stat-card.main {
      border-color: #6EE7B7;
      background: #F0FDF4;
    }
    .stat-label {
      font-size: 13px;
      color: #9CA3AF;
      margin-bottom: 12px;
    }
    .stat-val {
      font-size: 34px;
      font-weight: 700;
      color: #6B7280;
      font-variant-numeric: tabular-nums;
      letter-spacing: -0.01em;
    }
    .stat-val.money {
      color: #059669;
    }
    .stat-sub {
      font-size: 13px;
      color: #9CA3AF;
      margin-top: 10px;
    }
    @media print {
      body { padding: 20px 30px; }
    }
  </style>
</head>
<body>
  <div class="eyebrow">ANALITIKË</div>
  <h1>Raportet</h1>

  <div class="subtitle">Z-Report — Kendi POS</div>
  <div class="date">${M(i.value)}</div>

  <div class="stat-card main">
    <div class="stat-label">Total shitje</div>
    <div class="stat-val money">${n(x.value)}</div>
    <div class="stat-sub">${r.value.length} porosi</div>
  </div>

  <div class="stat-card">
    <div class="stat-label">Kesh</div>
    <div class="stat-val">${n(V.value)}</div>
    <div class="stat-sub">${e} porosi</div>
  </div>

  <div class="stat-card">
    <div class="stat-label">Kartë</div>
    <div class="stat-val">${n(q.value)}</div>
    <div class="stat-sub">${a} porosi</div>
  </div>

  <div class="stat-card">
    <div class="stat-label">Mesatarja / porosi</div>
    <div class="stat-val">${n(l)}</div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
        setTimeout(function() { window.close(); }, 500);
      }, 200);
    };
  <\/script>
</body>
</html>`;s.document.write(at),s.document.close()}function X(){const s=new Date,e=new Date(s.getFullYear(),s.getMonth()-1,1),a=new Date(s.getFullYear(),s.getMonth(),0);p.value=F(e),m.value=F(a),_.value=null,c.value=[],C.value=!0}function j(){C.value=!1,c.value=[]}function F(s){return s.getFullYear()+"-"+String(s.getMonth()+1).padStart(2,"0")+"-"+String(s.getDate()).padStart(2,"0")}async function Q(){if(_.value=null,!p.value||!m.value){_.value="Zgjidhni datat";return}if(p.value>m.value){_.value="Data e fillimit duhet të jetë para datës së fundit";return}T.value=!0;try{const s=new Date(p.value+"T12:00:00"),e=new Date(m.value+"T12:00:00"),a=[],l=new Date(s);for(;l<=e;){const h=F(l);try{const z=await N.get(`/reports/z-report?date=${h}`);a.push(z)}catch{a.push({date:h,totalRevenue:0,cashTotal:0,cardTotal:0,orderCount:0,avgOrder:0,topProducts:[],orders:[]})}l.setDate(l.getDate()+1)}c.value=a}catch(s){_.value=s.message}finally{T.value=!1}}const v=k(()=>({revenue:c.value.reduce((s,e)=>s+e.totalRevenue,0),cash:c.value.reduce((s,e)=>s+e.cashTotal,0),card:c.value.reduce((s,e)=>s+e.cardTotal,0)}));function S(s){return new Date(s+"T12:00:00").toLocaleDateString("sq-AL",{day:"2-digit",month:"2-digit",year:"numeric"})}function tt(s){return new Date(s+"T12:00:00").toLocaleDateString("sq-AL",{weekday:"short"})}function et(){window.print()}function st(){const s=B.settings.accountantEmail;if(!s){alert("Nuk keni caktuar email të kontabilistit. Shkoni te Cilësimet për ta shtuar.");return}const e=`Raporti mujor Kendi Cafe — ${S(p.value)} deri ${S(m.value)}`,a=`Përshëndetje,%0D%0A%0D%0ABashkangjitur do të gjeni raportin mujor të shitjeve për periudhën ${S(p.value)} - ${S(m.value)}.%0D%0A%0D%0ATotali i shitjeve: ${n(v.value.revenue)}%0D%0AKesh: ${n(v.value.cash)}%0D%0AKartë: ${n(v.value.card)}%0D%0A%0D%0AJu lutem konfirmoni pranimin.%0D%0A%0D%0AFaleminderit,%0D%0A${B.settings.venueName}`;window.location.href=`mailto:${s}?subject=${encodeURIComponent(e)}&body=${a}`}return(s,e)=>(u(),d("div",mt,[t("header",ht,[e[5]||(e[5]=t("div",null,[t("p",{class:"eyebrow"},"Analitikë"),t("h1",null,"Raportet")],-1)),t("div",gt,[t("button",{class:"k-btn k-btn--primary",onClick:X},[y(b(I),{size:16}),e[3]||(e[3]=D(" Raporti mujor ",-1))]),t("button",{class:"k-btn k-btn--ghost",onClick:W},[y(b(Y),{size:16}),e[4]||(e[4]=D(" Printo raportin ",-1))])])]),t("div",yt,[t("button",{class:"nav-btn",onClick:J},"←"),K(t("input",{type:"date","onUpdate:modelValue":e[0]||(e[0]=a=>i.value=a),class:"date-input"},null,512),[[P,i.value]]),t("button",{class:"nav-btn",onClick:G,disabled:H.value},"→",8,bt)]),t("div",ft,[e[6]||(e[6]=t("h2",null,"Z-Report — Kendi POS",-1)),t("p",null,o(M(i.value)),1)]),t("div",_t,[t("div",kt,[e[7]||(e[7]=t("p",{class:"stat-label"},"Total shitje",-1)),t("p",Dt,o(n(x.value)),1),t("p",wt,o(r.value.length)+" porosi",1)]),t("div",St,[e[8]||(e[8]=t("p",{class:"stat-label"},"Kesh",-1)),t("p",Tt,o(n(V.value)),1),t("p",xt,o(r.value.filter(a=>a.paymentMethod==="cash").length)+" porosi",1)]),t("div",$t,[e[9]||(e[9]=t("p",{class:"stat-label"},"Kartë",-1)),t("p",Ct,o(n(q.value)),1),t("p",At,o(r.value.filter(a=>a.paymentMethod==="card").length)+" porosi",1)]),t("div",Mt,[e[10]||(e[10]=t("p",{class:"stat-label"},"Mesatarja / porosi",-1)),t("p",jt,o(r.value.length?n(Math.round(x.value/r.value.length)):"€ 0.00"),1)])]),r.value.length===0?(u(),d("div",Ft,[t("p",null,"Nuk ka shitje për "+o(M(i.value)),1)])):w("",!0),r.value.length>0?(u(),d("div",zt,[t("div",Rt,[e[11]||(e[11]=t("h2",{class:"section-title"},"Produktet më të shitura",-1)),t("div",Kt,[(u(!0),d(L,null,O(A.value,(a,l)=>(u(),d("div",{key:a.name,class:"product-row"},[t("span",Pt,o(l+1),1),t("span",Lt,o(a.name),1),t("span",Ot,"× "+o(a.qty),1),t("div",Bt,[t("div",{class:"product-bar",style:dt({width:A.value.length?a.revenue/A.value[0].revenue*100+"%":"0%"})},null,4)]),t("span",Et,o(n(a.revenue)),1)]))),128))])]),t("div",Vt,[e[13]||(e[13]=t("h2",{class:"section-title"},"Porositë e ditës",-1)),t("table",qt,[e[12]||(e[12]=t("thead",null,[t("tr",null,[t("th",null,"Ora"),t("th",null,"Tavolina"),t("th",null,"Artikuj"),t("th",null,"Pagesa"),t("th",null,"Total")])],-1)),t("tbody",null,[(u(!0),d(L,null,O(r.value,a=>(u(),d("tr",{key:a.id},[t("td",Nt,o(Z(a.paidAt??a.closedAt)),1),t("td",null,o(a.tableId),1),t("td",null,o(a.items.reduce((l,h)=>l+h.quantity,0)),1),t("td",null,o(a.paymentMethod==="cash"?"Kesh":"Kartë"),1),t("td",It,o(n(a.total)),1)]))),128))])])])])):w("",!0),C.value?(u(),d("div",{key:2,class:"modal-bg",onClick:rt(j,["self"])},[t("div",Yt,[t("header",Ut,[t("div",Zt,[t("div",Jt,[y(b(I),{size:20})]),e[14]||(e[14]=t("div",null,[t("h2",null,"Raporti mujor"),t("p",{class:"eyebrow"},"Për kontabilistin")],-1))]),t("button",{class:"modal-close",onClick:j},[y(b(ct),{size:20})])]),t("div",Gt,[t("div",Ht,[t("div",Wt,[t("label",null,[y(b(U),{size:12}),e[15]||(e[15]=D(" Prej ",-1))]),K(t("input",{type:"date","onUpdate:modelValue":e[1]||(e[1]=a=>p.value=a),class:"k-input"},null,512),[[P,p.value]])]),e[17]||(e[17]=t("div",{class:"range-arrow"},"→",-1)),t("div",Xt,[t("label",null,[y(b(U),{size:12}),e[16]||(e[16]=D(" Deri ",-1))]),K(t("input",{type:"date","onUpdate:modelValue":e[2]||(e[2]=a=>m.value=a),class:"k-input"},null,512),[[P,m.value]])]),t("button",{class:"k-btn k-btn--primary generate-btn",onClick:Q,disabled:T.value},o(T.value?"Duke ngarkuar...":"Gjenero"),9,Qt)]),_.value?(u(),d("div",te,o(_.value),1)):w("",!0),c.value.length>0?(u(),d("div",ee,[t("div",se,[t("div",ae,[e[18]||(e[18]=t("p",{class:"summary-label"},"Totali i shitjeve",-1)),t("p",oe,o(n(v.value.revenue)),1)]),t("div",ne,[e[19]||(e[19]=t("p",{class:"summary-label"},"Kesh",-1)),t("p",le,o(n(v.value.cash)),1)]),t("div",ie,[e[20]||(e[20]=t("p",{class:"summary-label"},"Kartë",-1)),t("p",re,o(n(v.value.card)),1)])]),t("table",de,[e[22]||(e[22]=t("thead",null,[t("tr",null,[t("th",null,"Data"),t("th",null,"Ditë"),t("th",{class:"ta-right"},"Totali"),t("th",{class:"ta-right"},"Kesh"),t("th",{class:"ta-right"},"Kartë")])],-1)),t("tbody",null,[(u(!0),d(L,null,O(c.value,a=>(u(),d("tr",{key:a.date,class:ut({"row-empty":a.totalRevenue===0})},[t("td",ue,o(S(a.date)),1),t("td",ce,o(tt(a.date)),1),t("td",ve,o(n(a.totalRevenue)),1),t("td",pe,o(n(a.cashTotal)),1),t("td",me,o(n(a.cardTotal)),1)],2))),128))]),t("tfoot",null,[t("tr",null,[e[21]||(e[21]=t("td",{colspan:"2"},[t("strong",null,"TOTALI")],-1)),t("td",he,[t("strong",null,o(n(v.value.revenue)),1)]),t("td",ge,[t("strong",null,o(n(v.value.cash)),1)]),t("td",ye,[t("strong",null,o(n(v.value.card)),1)])])])])])):w("",!0)]),c.value.length>0?(u(),d("footer",be,[t("button",{class:"k-btn k-btn--ghost",onClick:j}," Mbyll "),t("button",{class:"k-btn k-btn--ghost",onClick:et},[y(b(Y),{size:14}),e[23]||(e[23]=D(" Ruaj si PDF ",-1))]),t("button",{class:"k-btn k-btn--primary",onClick:st},[y(b(vt),{size:14}),e[24]||(e[24]=D(" Dërgo te kontabilisti ",-1))])])):w("",!0)])])):w("",!0)]))}}),Ce=pt(fe,[["__scopeId","data-v-4ac30855"]]);export{Ce as default};
