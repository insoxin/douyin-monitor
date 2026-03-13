export default {

 async scheduled(event, env) {
  await collect(env)
 },

 async fetch(request, env) {

  const url = new URL(request.url)

  if (url.pathname === "/collect") {
   return collect(env,true)
  }

  if (url.pathname === "/api/data") {
   return getData(env)
  }

  if (url.pathname === "/debug") {
   return debug(env)
  }

  return new Response(dashboard(),{
   headers:{ "content-type":"text/html; charset=utf-8"}
  })

 }

}

async function douyinRequest(sec_uid){

 const api =
 `https://www.iesdouyin.com/web/api/v2/user/info/?sec_uid=${sec_uid}&aid=6383`

 const resp = await fetch(api,{
  headers:{
   "accept":"application/json, text/plain, */*",
   "accept-language":"zh-CN,zh;q=0.9",
   "referer":"https://www.douyin.com/",
   "user-agent":
   "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
  }
 })

 const buffer = await resp.arrayBuffer()

 const text = new TextDecoder("utf-8").decode(buffer)

 return text

}

async function collect(env,debug=false){

 const text = await douyinRequest(env.SEC_UID)

 if(debug){
  return new Response(text,{
   headers:{ "content-type":"text/plain; charset=utf-8"}
  })
 }

 const json = JSON.parse(text)

 const u = json.user_info

 const data = {

  date:new Date().toISOString().slice(0,10),

  nickname:u.nickname,

  signature:u.signature || "",

  avatar:u.avatar_larger?.url_list?.[0] || "",

  followers:u.mplatform_followers_count || u.follower_count,

  following:u.following_count,

  aweme:u.aweme_count,

  favoriting:u.favoriting_count,

  likes:u.total_favorited

 }

 const key = `history/${data.date}.json`

 const exist = await env.R2.get(key)

 if(!exist){
  await env.R2.put(key,JSON.stringify(data))
 }

 return new Response("collect ok")

}

async function getData(env){

 const list = await env.R2.list({
  prefix:"history/"
 })

 const arr=[]

 for(const obj of list.objects){

  const file = await env.R2.get(obj.key)

  arr.push(await file.json())

 }

 arr.sort((a,b)=>a.date.localeCompare(b.date))

 return new Response(JSON.stringify(arr),{
  headers:{
   "content-type":"application/json; charset=utf-8",
   "Access-Control-Allow-Origin":"*"
  }
 })

}

async function debug(env){

 const text = await douyinRequest(env.SEC_UID)

 return new Response(text,{
  headers:{ "content-type":"text/plain; charset=utf-8"}
 })

}

function dashboard(){

return `

<!DOCTYPE html>
<html>

<head>

<meta charset="UTF-8">

<title>Douyin Monitor</title>

<script src="https://cdn.jsdelivr.net/npm/echarts@5"></script>

<style>

body{
margin:0;
font-family:Arial;
background:#0f172a;
color:white;
}

.container{
max-width:1200px;
margin:auto;
padding:40px;
}

.stats{
display:flex;
flex-wrap:wrap;
gap:20px;
margin-bottom:30px;
}

.card{
background:#1e293b;
padding:20px;
border-radius:10px;
flex:1;
min-width:140px;
text-align:center;
}

.avatar{
width:80px;
border-radius:50%;
margin-bottom:10px;
}

.signature{
font-size:12px;
opacity:0.7;
margin-top:6px;
line-height:1.4;
max-height:40px;
overflow:hidden;
}

.chart{
height:320px;
margin-top:30px;
}

button{
background:#334155;
border:none;
color:white;
padding:6px 12px;
margin-right:10px;
border-radius:6px;
cursor:pointer;
}

button:hover{
background:#475569;
}

</style>

</head>

<body>

<div class="container">

<h2>抖音账号监控</h2>

<div class="stats">

<div class="card">

<img id="avatar" class="avatar">

<h3 id="nickname"></h3>

<div id="signature" class="signature"></div>

</div>

<div class="card">
粉丝
<h2 id="followers"></h2>
</div>

<div class="card">
关注
<h2 id="following"></h2>
</div>

<div class="card">
作品
<h2 id="aweme"></h2>
</div>

<div class="card">
获赞
<h2 id="likes"></h2>
</div>

<div class="card">
点赞
<h2 id="favoriting"></h2>
</div>

<div class="card">
今日涨粉
<h2 id="today"></h2>
</div>

<div class="card">
活跃度
<h2 id="activity"></h2>
</div>

<div class="card">
粉丝量级
<h2 id="level"></h2>
</div>

</div>

<div>

<button onclick="setRange(7)">7天</button>
<button onclick="setRange(30)">30天</button>
<button onclick="setRange(90)">90天</button>
<button onclick="setRange(365)">一年</button>
<button onclick="setRange(9999)">全部</button>

</div>

<div id="followersChart" class="chart"></div>

<div id="growthChart" class="chart"></div>

</div>

<script>

let raw=[]
let range=30

async function load(){

 const resp = await fetch("/api/data")

 raw = await resp.json()

 updateStats()

 render()

}

function setRange(r){

 range=r

 render()

}

function updateStats(){

 const last = raw[raw.length-1]

 document.getElementById("avatar").src = last.avatar

 document.getElementById("nickname").innerText = last.nickname

 document.getElementById("signature").innerText = last.signature || ""

 document.getElementById("followers").innerText = format(last.followers)

 document.getElementById("following").innerText = last.following

 document.getElementById("aweme").innerText = last.aweme

 document.getElementById("likes").innerText = format(last.likes)

 document.getElementById("favoriting").innerText = format(last.favoriting)

 if(raw.length>1){

  const prev = raw[raw.length-2]

  const diff = last.followers - prev.followers

  document.getElementById("today").innerText = diff

 }

 document.getElementById("activity").innerText = activity(last)

 document.getElementById("level").innerText = level(last.followers)

}

function render(){

 let data=[...raw]

 if(range!==9999){
  data=data.slice(-range)
 }

 const dates=data.map(i=>i.date)

 const followers=data.map(i=>i.followers)

 const growth=[]

 for(let i=1;i<data.length;i++){
  growth.push(data[i].followers-data[i-1].followers)
 }

 draw("followersChart",dates,followers,"粉丝趋势")

 draw("growthChart",dates.slice(1),growth,"每日涨粉")

}

function draw(id,x,data,title){

 const chart = echarts.init(document.getElementById(id))

 chart.setOption({

  title:{ text:title },

  tooltip:{},

  xAxis:{ type:"category",data:x },

  yAxis:{ type:"value" },

  series:[
   {
    type:"line",
    smooth:true,
    data:data
   }
  ]

 })

}

function activity(u){

 const avgLikes = u.likes / Math.max(u.aweme,1)

 const ratio = avgLikes / Math.max(u.followers,1)

 if(ratio > 0.2) return "🔥 爆款"

 if(ratio > 0.1) return "高活跃"

 if(ratio > 0.03) return "正常"

 return "低互动"

}

function level(f){

 if(f < 1000) return "素人"

 if(f < 10000) return "小号"

 if(f < 100000) return "达人"

 if(f < 1000000) return "大V"

 if(f < 10000000) return "头部"

 return "超级KOL"

}

function format(n){

 if(n > 100000000) return (n/100000000).toFixed(1)+"亿"

 if(n > 10000) return (n/10000).toFixed(1)+"万"

 return n

}

load()

</script>

</body>

</html>

`
}
