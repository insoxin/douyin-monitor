export default {

  async fetch(request, env) {

    const url = new URL(request.url)

    if (url.pathname === "/collect") {
      return debugCollect(env, url)
    }

    return new Response("worker running")
  }

}

async function debugCollect(env,url){

  const raw = url.searchParams.get("raw")

  let log = []

  log.push("===== DOUBYIN MONITOR DEBUG =====")
  log.push("time: "+ new Date().toISOString())

  const sec_uid = env.SEC_UID

  log.push("SEC_UID: "+sec_uid)

  if(!sec_uid){

    log.push("ERROR: SEC_UID not set")

    return new Response(log.join("\n"),{
      headers:{ "content-type":"text/plain" }
    })
  }

  const api =
  `https://www.iesdouyin.com/web/api/v2/user/info/?sec_uid=${sec_uid}`

  log.push("")
  log.push("REQUEST URL:")
  log.push(api)

  const resp = await fetch(api,{
    headers:{
      "user-agent":"Mozilla/5.0",
      "accept":"application/json,text/plain,*/*"
    }
  })

  log.push("")
  log.push("HTTP STATUS: "+resp.status)

  log.push("")
  log.push("RESPONSE HEADERS:")

  for(const [k,v] of resp.headers){

    log.push(k+": "+v)

  }

  const text = await resp.text()

  if(raw){

    return new Response(text,{
      headers:{ "content-type":"text/plain" }
    })

  }

  log.push("")
  log.push("===== RESPONSE BODY (FULL) =====")
  log.push(text)

  log.push("")
  log.push("===== JSON PARSE =====")

  let json

  try{

    json = JSON.parse(text)

    log.push("JSON parse success")

  }catch(e){

    log.push("JSON parse failed: "+e)

    return new Response(log.join("\n"),{
      headers:{ "content-type":"text/plain" }
    })

  }

  if(!json.user_info){

    log.push("")
    log.push("ERROR: user_info not found")

    return new Response(log.join("\n"),{
      headers:{ "content-type":"text/plain" }
    })

  }

  const u = json.user_info

  log.push("")
  log.push("===== PARSED USER INFO =====")

  log.push("nickname: "+u.nickname)
  log.push("followers: "+u.follower_count)
  log.push("following: "+u.following_count)
  log.push("aweme: "+u.aweme_count)
  log.push("likes: "+u.total_favorited)

  const data = {

    date:new Date().toISOString().slice(0,10),

    nickname:u.nickname,

    followers:u.follower_count,

    following:u.following_count,

    aweme:u.aweme_count,

    likes:u.total_favorited
  }

  const key = `history/${data.date}.json`

  log.push("")
  log.push("R2 KEY: "+key)

  try{

    await env.R2.put(key,JSON.stringify(data))

    log.push("R2 write success")

  }catch(e){

    log.push("R2 write failed: "+e)

  }

  log.push("")
  log.push("===== DEBUG END =====")

  return new Response(log.join("\n"),{
    headers:{ "content-type":"text/plain" }
  })

}
