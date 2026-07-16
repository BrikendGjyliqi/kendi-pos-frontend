import{d as N,j as k,o as Y,K as M,H as U,c as i,e as t,g as H,f as y,h as $,F as A,r as C,w as J,v as W,t as a,s as P,L,q as w,k as h,n as G,z as Q,l as n}from"./index-BGNIbHHd.js";import{P as X}from"./printer-CYkLcITl.js";import{S as R}from"./shield-D0fmCuqE.js";import{U as K}from"./user-KmaorzpG.js";import{_ as Z}from"./_plugin-vue_export-helper-DnafTyV7.js";const tt={class:"page"},st={class:"page-head"},et={class:"controls no-print"},at={class:"staff-selector"},ot=["onClick"],nt={class:"staff-role"},lt={class:"date-nav"},it=["disabled"],rt={class:"print-header print-only"},dt={key:0,class:"stats-grid"},ct={class:"stat-card stat-card--main"},ut={class:"stat-staff-info"},pt={class:"stat-staff-name"},vt={class:"stat-staff-role"},ht={class:"stat-val money"},mt={class:"stat-sub"},ft={class:"stat-card"},_t={class:"stat-val"},gt={class:"stat-sub"},yt={class:"stat-card"},bt={class:"stat-val"},kt={class:"stat-sub"},wt={class:"stat-card stat-card--tip"},xt={class:"stat-val tip"},St={class:"stat-sub"},Tt={class:"stat-card"},$t={class:"stat-val"},At={key:1,class:"k-empty"},Ct={key:2,class:"sections"},Dt={class:"section k-card no-print"},zt={class:"products-list"},Bt={class:"product-rank"},Ft={class:"product-name"},Mt={class:"product-qty mono"},Pt={class:"product-bar-wrap"},Lt={class:"product-revenue mono"},Rt={class:"section k-card no-print"},Kt={class:"section-title"},jt={class:"orders-table"},It={class:"mono"},Et={class:"mono tip"},Ot={key:0},Vt={key:0,class:"tip-pct"},qt={key:1,class:"dim"},Nt={class:"mono money"},Yt={class:"mono tip",style:{"font-weight":"700",padding:"12px 16px"}},Ut={class:"mono money",style:{"font-weight":"700",padding:"12px 16px"}},Ht=N({__name:"StaffReportView",setup(Jt){function x(){const s=new Date,o=s.getFullYear(),u=String(s.getMonth()+1).padStart(2,"0"),v=String(s.getDate()).padStart(2,"0");return`${o}-${u}-${v}`}const _=k([]),m=k(null),r=k(x()),p=k(null);function l(s){return"€ "+(s/100).toFixed(2)}async function D(){if(!m.value){p.value=null;return}p.value=await M.get(`/reports/staff?staffId=${m.value}&date=${r.value}`)}Y(async()=>{_.value=await M.get("/staff"),_.value.length>0&&(m.value=_.value[0].id,await D())}),U([m,r],D);const c=h(()=>_.value.find(s=>s.id===m.value)??null),d=h(()=>{var s;return((s=p.value)==null?void 0:s.orders)??[]}),b=h(()=>{var s;return((s=p.value)==null?void 0:s.totalRevenue)??0}),z=h(()=>{var s;return((s=p.value)==null?void 0:s.cashTotal)??0}),B=h(()=>{var s;return((s=p.value)==null?void 0:s.cardTotal)??0}),F=h(()=>{var s;return((s=p.value)==null?void 0:s.tipTotal)??0}),S=h(()=>{var s;return((s=p.value)==null?void 0:s.products)??[]}),j=h(()=>d.value.filter(s=>(s.tipAmount??0)>0).length);function T(s){return new Date(s+"T12:00:00").toLocaleDateString("sq-AL",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}function I(s){return s?new Date(s).toLocaleTimeString("sq-AL",{hour:"2-digit",minute:"2-digit"}):"—"}function E(){const s=new Date(r.value+"T12:00:00");s.setDate(s.getDate()-1);const o=s.getFullYear(),u=String(s.getMonth()+1).padStart(2,"0"),v=String(s.getDate()).padStart(2,"0");r.value=`${o}-${u}-${v}`}function O(){const s=new Date(r.value+"T12:00:00");s.setDate(s.getDate()+1);const o=s.getFullYear(),u=String(s.getMonth()+1).padStart(2,"0"),v=String(s.getDate()).padStart(2,"0"),e=`${o}-${u}-${v}`;e<=x()&&(r.value=e)}const V=h(()=>r.value===x());function q(){if(!c.value||!p.value)return;const s=window.open("","_blank","width=900,height=1100");if(!s){alert("Ju lutem lejoni pop-up-et për të printuar.");return}const o=d.value.filter(g=>g.paymentMethod==="cash").length,u=d.value.filter(g=>g.paymentMethod==="card").length,f=`<!DOCTYPE html>
<html>
<head>
  <title>Raport ${c.value.name}</title>
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
  <h1>Raporti i personelit</h1>

  <div class="subtitle">${c.value.name} — Kendi POS</div>
  <div class="date">${T(r.value)}</div>

  <div class="stat-card main">
    <div class="stat-label">Total shitje</div>
    <div class="stat-val money">${l(b.value)}</div>
    <div class="stat-sub">${d.value.length} porosi</div>
  </div>

  <div class="stat-card">
    <div class="stat-label">Kesh</div>
    <div class="stat-val">${l(z.value)}</div>
    <div class="stat-sub">${o} porosi</div>
  </div>

  <div class="stat-card">
    <div class="stat-label">Kartë</div>
    <div class="stat-val">${l(B.value)}</div>
    <div class="stat-sub">${u} porosi</div>
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
</html>`;s.document.write(f),s.document.close()}return(s,o)=>{var u,v;return n(),i("div",tt,[t("header",st,[o[2]||(o[2]=t("div",null,[t("p",{class:"eyebrow"},"Analitikë"),t("h1",null,"Raporti i personelit")],-1)),t("button",{class:"k-btn k-btn--ghost no-print",onClick:q},[H(y(X),{size:16}),o[1]||(o[1]=$(" Printo raportin ",-1))])]),t("div",et,[t("div",at,[(n(!0),i(A,null,C(_.value,e=>(n(),i("button",{key:e.id,class:G(["staff-btn",m.value===e.id&&"staff-btn--active"]),onClick:f=>m.value=e.id},[(n(),P(L(e.role==="admin"?y(R):y(K)),{size:14})),$(" "+a(e.name)+" ",1),t("span",nt,a(e.role==="admin"?"Admin":"Banakier"),1)],10,ot))),128))]),t("div",lt,[t("button",{class:"nav-btn",onClick:E},"←"),J(t("input",{type:"date","onUpdate:modelValue":o[0]||(o[0]=e=>r.value=e),class:"date-input"},null,512),[[W,r.value]]),t("button",{class:"nav-btn",onClick:O,disabled:V.value},"→",8,it)])]),t("div",rt,[t("h2",null,"Raport Personeli — "+a((u=c.value)==null?void 0:u.name),1),t("p",null,a(T(r.value)),1)]),c.value?(n(),i("div",dt,[t("div",ct,[t("div",ut,[(n(),P(L(c.value.role==="admin"?y(R):y(K)),{size:22})),t("div",null,[t("p",pt,a(c.value.name),1),t("p",vt,a(c.value.role==="admin"?"Admin":"Banakier"),1)])]),o[3]||(o[3]=t("p",{class:"stat-label"},"Total shitje",-1)),t("p",ht,a(l(b.value)),1),t("p",mt,a(d.value.length)+" porosi",1)]),t("div",ft,[o[4]||(o[4]=t("p",{class:"stat-label"},"Kesh",-1)),t("p",_t,a(l(z.value)),1),t("p",gt,a(d.value.filter(e=>e.paymentMethod==="cash").length)+" porosi",1)]),t("div",yt,[o[5]||(o[5]=t("p",{class:"stat-label"},"Kartë",-1)),t("p",bt,a(l(B.value)),1),t("p",kt,a(d.value.filter(e=>e.paymentMethod==="card").length)+" porosi",1)]),t("div",wt,[o[6]||(o[6]=t("p",{class:"stat-label"},"Bakshishi",-1)),t("p",xt,a(l(F.value)),1),t("p",St,a(j.value)+" porosi me bakshish",1)]),t("div",Tt,[o[7]||(o[7]=t("p",{class:"stat-label"},"Mesatarja / porosi",-1)),t("p",$t,a(d.value.length?l(Math.round(b.value/d.value.length)):"€ 0.00"),1)])])):w("",!0),d.value.length===0&&c.value?(n(),i("div",At,[t("p",null,a(c.value.name)+" nuk ka asnjë shitje për "+a(T(r.value)),1)])):w("",!0),d.value.length>0?(n(),i("div",Ct,[t("div",Dt,[o[8]||(o[8]=t("h2",{class:"section-title"},"Produktet e shitura",-1)),t("div",zt,[(n(!0),i(A,null,C(S.value,(e,f)=>(n(),i("div",{key:e.name,class:"product-row"},[t("span",Bt,a(f+1),1),t("span",Ft,a(e.name),1),t("span",Mt,"× "+a(e.qty),1),t("div",Pt,[t("div",{class:"product-bar",style:Q({width:S.value.length?e.revenue/S.value[0].revenue*100+"%":"0%"})},null,4)]),t("span",Lt,a(l(e.revenue)),1)]))),128))])]),t("div",Rt,[t("h2",Kt,"Porositë e "+a((v=c.value)==null?void 0:v.name),1),t("table",jt,[o[10]||(o[10]=t("thead",null,[t("tr",null,[t("th",null,"Ora"),t("th",null,"Tavolina"),t("th",null,"Artikuj"),t("th",null,"Pagesa"),t("th",null,"Bakshish"),t("th",null,"Total")])],-1)),t("tbody",null,[(n(!0),i(A,null,C(d.value,e=>(n(),i("tr",{key:e.id},[t("td",It,a(I(e.paidAt??e.closedAt)),1),t("td",null,a(e.tableId),1),t("td",null,a(e.items.reduce((f,g)=>f+g.quantity,0)),1),t("td",null,a(e.paymentMethod==="cash"?"Kesh":"Kartë"),1),t("td",Et,[(e.tipAmount??0)>0?(n(),i("span",Ot,[$(a(l(e.tipAmount))+" ",1),e.tipPercent?(n(),i("span",Vt,"("+a(e.tipPercent)+"%)",1)):w("",!0)])):(n(),i("span",qt,"—"))]),t("td",Nt,a(l(e.total)),1)]))),128))]),t("tfoot",null,[t("tr",null,[o[9]||(o[9]=t("td",{colspan:"4",style:{"font-weight":"700",padding:"12px 16px"}},"TOTALI",-1)),t("td",Yt,a(l(F.value)),1),t("td",Ut,a(l(b.value)),1)])])])])])):w("",!0)])}}}),ts=Z(Ht,[["__scopeId","data-v-26f9eddc"]]);export{ts as default};
