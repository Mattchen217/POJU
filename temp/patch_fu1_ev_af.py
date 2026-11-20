from pathlib import Path
p = Path(r"docs/eastern-os/decision-intake-2.0/evidence/m2-4-phase4-answer-ask/CONTRACT-M2-4-R2-FU1.md")
t = p.read_text(encoding="utf-8")
start = t.find("## Existing R2 A")
end = t.find("## Regression exit codes")
if start < 0 or end < 0:
    raise SystemExit(f"markers missing start={start} end={end}")
new = """## Existing R2 A–F logs (same run, after draft updates)

```
[m24r2a] round=1 input=我目前仍在职，月薪三万。另外家里有一个孩子。; facts=2; written=fact_m1_ff85c94c-3040-43e3-a309-dcdb028796fd_0:unverified:user_asserted:hard_constraint|fact_m1_ff85c94c-3040-43e3-a309-dcdb028796fd_1:unverified:user_asserted:hard_constraint; dc=1->2; ctx_ver=2; next_q=关于「要不要离职去创业？」——有哪些真实可选方案（不要只重复决策目标）？（这样我才能判断：Needed for DIR-OPT-ON-TABLE）; next_dirs=DIR-OPT-ON-TABLE; next_roles=v1/dir/DIR-OPT-ON-TABLE/role/option; asked=1->2
[m24r2a] round=2 input=大概还能撑 6 个月。硬约束是必须保留社保。; estimate=fact_m1_eac78bcf-6cdc-4570-9ee2-b795410666fd_0:unverified:user_estimate; constraint=cst_m1_eac78bcf-6cdc-4570-9ee2-b795410666fd_1:unverified; facts=4; constraints=1; dc=2->3; ctx_ver=3; next_q=关于「要不要离职去创业？」——可以接受的最差结果是什么？（这样我才能判断：Needed for DIR-RISK-TOLERANCE）; next_dirs=DIR-RISK-TOLERANCE; next_roles=v1/dir/DIR-RISK-TOLERANCE/role/risk; asked=2->3
[m24r2a] round=3 input=更正一下，我已经离职了，不是仍在职。另外还有一个备选是内部转岗。; kept_original=fact_m1_ff85c94c-3040-43e3-a309-dcdb028796fd_0; correction=fact_m1_cc4694e0-82c1-4d46-87ce-d3454485ce41_0; supplement=fact_m1_cc4694e0-82c1-4d46-87ce-d3454485ce41_1; conflicts=cf_m1_cc4694e0-82c1-4d46-87ce-d3454485ce41_0:open:fact_m1_ff85c94c-3040-43e3-a309-dcdb028796fd_0+fact_m1_cc4694e0-82c1-4d46-87ce-d3454485ce41_0; fact_ids_before=fact_m1_eac78bcf-6cdc-4570-9ee2-b795410666fd_0,fact_m1_eac78bcf-6cdc-4570-9ee2-b795410666fd_2,fact_m1_ff85c94c-3040-43e3-a309-dcdb028796fd_0,fact_m1_ff85c94c-3040-43e3-a309-dcdb028796fd_1; fact_ids_after=fact_m1_ff85c94c-3040-43e3-a309-dcdb028796fd_0,fact_m1_ff85c94c-3040-43e3-a309-dcdb028796fd_1,fact_m1_eac78bcf-6cdc-4570-9ee2-b795410666fd_0,fact_m1_eac78bcf-6cdc-4570-9ee2-b795410666fd_2,fact_m1_cc4694e0-82c1-4d46-87ce-d3454485ce41_0,fact_m1_cc4694e0-82c1-4d46-87ce-d3454485ce41_1; dc=3->4; ctx_ver=4; next_q=我发现这项信息存在两条不一致的记录：
1. 我目前仍在职，月薪三万。
2. 我已经离职了，不是仍在职。
请明确选择哪一条准确。也可以说明两条都不准确，我会继续核实，不会自行替你判断。; next_dirs=DIR-OPT-CONSTRAINTS; next_cf=cf_m1_cc4694e0-82c1-4d46-87ce-d3454485ce41_0
[m24r2b] auth_dirs=DIR-OPT-CONSTRAINTS; auth_roles=hard_constraint; overreach_facts=0; legal_facts=1; dc=1->2
[m24r2c] facts=fact_m1_a9e1577f-dce0-4085-84af-85d27d9e430e_0:unverified:user_asserted:confirm=undefined
[m24r2d_timeout] outcome=answer_interpretation_failed; dc=1->1; facts=0; constraints=0; asked=1; last_sent=qp_cq_dir_DIR-OPT-CONSTRAINTS_2026-11-08T12:00:00.000Z; asst=【系统】本轮回答未能完成语义理解，决策上下文未写入。请稍后重试，或换一种表述。(timeout:llm_timeout)
[m24r2d_json] outcome=answer_interpretation_invalid_schema; dc=1->1; facts=0; constraints=0; asked=1; last_sent=qp_cq_dir_DIR-OPT-CONSTRAINTS_2026-11-08T12:00:00.000Z; asst=【系统】本轮回答未能完成语义理解，决策上下文未写入。请稍后重试，或换一种表述。(invalid_json:Unexpected token 'h', "this is not json {" is not valid JSON)
[m24r2d_schema] outcome=answer_interpretation_invalid_schema; dc=1->1; facts=0; constraints=0; asked=1; last_sent=qp_cq_dir_DIR-OPT-CONSTRAINTS_2026-11-08T12:00:00.000Z; asst=【系统】本轮回答未能完成语义理解，决策上下文未写入。请稍后重试，或换一种表述。(invalid_schema:extracted_items_not_array)
[m24r2e] tag=m24r2e_estimate; input=这个数字只是估计。; writes=unverified:user_estimate
[m24r2e] tag=m24r2e_unknown; input=我现在还无法确定。; writes=unknown:none
[m24r2e] tag=m24r2e_declined; input=这部分我不想回答。; writes=declined:none
[m24r2e] tag=m24r2e_unverified; input=我需要再核实一下。; writes=none
[m24r2f] turn=44b59e9e-895f-41a4-afe1-99e7bf029933; facts=1; constraints=1; dc=2->2; asked=2; q_recovered=true
```

"""
p.write_text(t[:start] + new + t[end:], encoding="utf-8", newline="\n")
print("patched", p.stat().st_size)
