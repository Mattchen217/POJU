/**
 * Understanding-gate fields are shown to the user (and fed into later prompts).
 * Models often narrate the querent as 他/她 in JSON; rewrite to 你 for second-person address.
 *
 * Keeps third-party 他/她 when they are not the querent subject (best-effort pattern set).
 */

/** Common counselor third-person → second-person for the querent (zh). */
export function rewriteUnderstandingFieldSecondPerson(text: string): string {
  let t = text.trim();
  if (!t) return t;

  const verbPairs: Array<[RegExp, string]> = [
    [/强烈反对她/g, "强烈反对你"],
    [/强烈反对他/g, "强烈反对你"],
    [/反对她/g, "反对你"],
    [/反对他/g, "反对你"],
    [/觉得她/g, "觉得你"],
    [/觉得他/g, "觉得你"],
    [/认为她/g, "认为你"],
    [/认为他/g, "认为你"],
    [/希望她/g, "希望你"],
    [/希望他/g, "希望你"],
    [/劝她/g, "劝你"],
    [/劝他/g, "劝你"],
    [/逼她/g, "逼你"],
    [/逼他/g, "逼你"],
    [/让她(?![人男友子女亲友爸妈])/g, "让你"],
    [/让他(?![人男友子女亲友爸妈])/g, "让你"],
    [/要她(?![人男友子女亲友爸妈])/g, "要你"],
    [/要他(?![人男友子女亲友爸妈])/g, "要你"],
    [/她折腾/g, "你折腾"],
    [/他折腾/g, "你折腾"],
    [/她离职/g, "你离职"],
    [/他离职/g, "你离职"],
    [/她创业/g, "你创业"],
    [/他创业/g, "你创业"],
    [/她极度/g, "你极度"],
    [/他极度/g, "你极度"],
    [/她现在/g, "你现在"],
    [/他现在/g, "你现在"],
    [/她已经/g, "你已经"],
    [/他已经/g, "你已经"],
    [/她一直/g, "你一直"],
    [/他一直/g, "你一直"],
    [/她感觉/g, "你感觉"],
    [/他感觉/g, "你感觉"],
    [/她觉得/g, "你觉得"],
    [/他觉得/g, "你觉得"],
    [/她想/g, "你想"],
    [/他想/g, "你想"],
    [/她纠结/g, "你纠结"],
    [/他纠结/g, "你纠结"],
    [/她的身体/g, "你的身体"],
    [/他的身体/g, "你的身体"],
    [/她的情绪/g, "你的情绪"],
    [/他的情绪/g, "你的情绪"],
    [/她的工作/g, "你的工作"],
    [/他的工作/g, "你的工作"],
  ];

  for (const [re, to] of verbPairs) {
    t = t.replace(re, to);
  }

  // Sentence / clause start: 她/他 as subject of the next clause.
  t = t.replace(/(^|[。！？；;\n])她/g, "$1你");
  t = t.replace(/(^|[。！？；;\n])他(?![人男友子女亲友爸妈])/g, "$1你");

  return t;
}
