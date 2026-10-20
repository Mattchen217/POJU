const fs=require("fs");
for (const loc of ["en","zh","es","fr"]) {
  const j=JSON.parse(fs.readFileSync("messages/"+loc+".json","utf8"));
  const w=j.poju_matrix?.card?.welcome;
  const sp=j.session_prep;
  const chat=j.poju?.chat;
  console.log("====",loc,"====");
  console.log("welcome", JSON.stringify(w,null,2));
  console.log("session_prep", JSON.stringify({welcome_title:sp?.welcome_title, welcome_desc:sp?.welcome_desc},null,2));
  console.log("chat keys", JSON.stringify({
    thinking_wait: chat?.thinking_wait,
    replying_wait: chat?.replying_wait,
    birth_flow_intro_title: chat?.birth_flow_intro_title,
    birth_flow_intro_body: chat?.birth_flow_intro_body,
    birth_flow_intro_cta_hint: chat?.birth_flow_intro_cta_hint,
  },null,2));
  console.log("hero_solar", j.poju_matrix?.card?.hero_solar);
  console.log("true_solar", j.poju_matrix?.card?.true_solar, j.poju_matrix?.card?.true_solar_time, j.birth_form?.true_solar_offset);
}
