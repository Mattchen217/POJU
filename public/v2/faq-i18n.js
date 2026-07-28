/* Eastern OS landing FAQ — nested accordion */
window.V2_FAQ_I18N = {
  zh: {
    titleGold: "系统架构",
    titleRest: "与常见解答",
    subtitle: "关于 Eastern OS 运行机制、隐私安全与订阅计费的解答。",
    categories: [
      {
        id: "product_methodology",
        title: "一、产品与方法",
        faqs: [
          {
            id: "q1",
            question: "Eastern OS 里有哪些模块，我该怎么选？",
            answer:
              "按你面对的问题选：一次重大转型或走不出的困境 → <strong class='v2-faq-name'>Pivot</strong>；<br>想看两个人合不合拍 → <strong class='v2-faq-name'>Match</strong>；<br>一件要紧事拿不准何时出手 → <strong class='v2-faq-name'>Syncro</strong>；<br>每天的整体节奏与精力投向 → <strong class='v2-faq-name'>Atmos</strong>；<br>复杂到连问题都问不清、想把隐性结构照出来 → <strong class='v2-faq-name'>Glyph</strong>。",
          },
          {
            id: "q2",
            question: "一次分析大概要多久？",
            answer:
              "因人而异——处境不同、问题不同，所需深度也不同，没有固定时长。单次交付通常约 3–5 分钟；部分模块会经过多轮层层递进，把一件事逐步谈透。",
          },
          {
            id: "q3",
            question: "Eastern OS 的交付，到底是什么？",
            answer:
              "不是一句结论，也不是一段无从核对的话。你拿到的是一份结构化分析：对你处境的判断、清晰的方向，以及可以直接上手的具体行动；每条结论都挂着一段能展开的依据，你看得见它“为什么这么说”。最终怎么做，决定权始终在你。<span class='v2-faq-gold'>（提示：系统分析仅供决策思路参考，不构成法律、医疗或财务等专业领域的终极建议。）</span>",
          },
        ],
      },
      {
        id: "during_session",
        title: "二、使用过程中要注意什么",
        faqs: [
          {
            id: "q4",
            question: "如果我的问题 / 困境描述得很模糊，会影响结果吗？",
            answer:
              "会。你说得越具体，分析越贴你。把你真正卡在哪、在意什么如实讲清，系统才能据此给出贴合你的判断，而不是泛泛而谈。",
          },
          {
            id: "q5",
            question: "开始使用前，我需要准备什么？",
            answer:
              "只需两样：想清楚你想弄明白的那件事，以及选择对应的功能。基线参数首次使用时录入、只需一次，之后每个模块都能直接用。",
          },
          {
            id: "q6",
            question: "分析出来的报告，我可以保存或带走吗？",
            answer:
              "可以。每次生成的报告都支持导出留存，建议你在生成后自行下载保存。由于记录只存在你本地浏览器、换设备不会同步，想长期留存就靠这一步——存下来的报告始终在你自己手里。",
          },
        ],
      },
      {
        id: "privacy_storage",
        title: "三、数据隐私与本地存储",
        faqs: [
          {
            id: "q7",
            question: "本地存储架构是怎么运作的？",
            answer:
              "你的所有分析内容与历史记录只加密保存在你当前使用的浏览器本地，<span class='v2-faq-gold'>不上传我们的服务器。</span>你的数据只属于你。",
          },
          {
            id: "q8",
            question: "换设备或换浏览器，还能看到之前的记录吗？",
            answer:
              "看不到。数据只在本地，换设备、换浏览器都不会同步旧记录——这是为隐私做的主动取舍。想留存请在生成后自行导出；跟随账户的，只有 Pass 的购买记录、消耗记录和剩余数量。",
          },
          {
            id: "q9",
            question: "你们服务器真的完全接触不到我的记录吗？",
            answer:
              "是的。生成分析时，系统只在当次处理必要内容并即时返回，不留存你的内容与记录；它们只加密躺在你自己的浏览器里。我们服务器上没有你的分析内容——<span class='v2-faq-gold'>连我们也看不到。</span>",
          },
        ],
      },
      {
        id: "billing_vouchers",
        title: "四、订阅计费与额度",
        faqs: [
          {
            id: "q10",
            question: "订阅额度会累积到下个月吗？",
            answer:
              "不会。订阅额度按月计，当月有效、不结转，每个订阅周期重置。订阅将在到期时自动续费，你可以随时在账户设置里取消订阅，取消后下一周期不再扣费。",
          },
          {
            id: "q11",
            question: "这个月额度用完了，还想继续用怎么办？",
            answer: "随时可按 $9.99 单次继续，不必等下个周期；也可升级到更高一档订阅。",
          },
          {
            id: "q12",
            question: "单次(Single Use)和订阅，有什么区别？",
            answer:
              "单次 = 即买即用，购买后永久有效（不限当月），用完即止，适合只想解决眼前一件事的人；<br>订阅 = 高频使用者的省钱之选，含每月 Atmos 与全模块额度（当月有效）。按你的使用频率选，哪种都不吃亏。",
          },
        ],
      },
      {
        id: "account_usage",
        title: "五、账号与设备",
        faqs: [
          {
            id: "q13",
            question: "一个账号可以几个人 / 几台设备一起用吗？",
            answer:
              "可以。同一账号能在多台设备登录共用，每次使用只扣一次额度，与人数无关；每个人的记录各存在自己的浏览器本地，彼此互不可见——共享的是额度，不是隐私。<span class='v2-faq-gold'>请妥善保管登录凭证，账户下的购买与消耗视为账户所有者本人操作。</span>",
          },
          {
            id: "q14",
            question: "可以更改绑定的注册邮箱吗？",
            answer: "可以，在账户设置里更改登录邮箱；订阅权益与 Pass 剩余数量会跟随账户一并保留。",
          },
          {
            id: "q15",
            question: "生成报告时我离开或误关了网页，额度会被扣掉吗？",
            answer:
              "不会白扣。只要你已发起，后台都会照常完成整份报告，并递交回你当前的浏览器——所以正常情况下你回来还能看到它。唯一例外：若你中途换了浏览器或设备，回来时会看不到那份记录(数据只存本地之故)。万一真的遇到这种情况，请联系我们<span class='v2-faq-gold'>（support@easternos.com）</span>，核实后我们会把这次的 Pass 返还给你。<span class='v2-faq-gold'>（注：数字商品一经交付完成不支持退款，但因技术故障导致的异常消耗我们将全额补偿。）</span>",
          },
        ],
      },
    ],
  },
  en: {
    titleGold: "System Architecture",
    titleRest: "& FAQs.",
    subtitle: "Answers regarding Eastern OS mechanics, data privacy, and subscription billing.",
    categories: [
      {
        id: "product_methodology",
        title: "1. Product & Methodology",
        faqs: [
          {
            id: "q1",
            question: "What modules are in Eastern OS, and how do I choose?",
            answer:
              "Choose based on your immediate situation: Major transitions or stuck dilemmas → <strong class='v2-faq-name'>Pivot</strong>;<br>Compatibility between two people → <strong class='v2-faq-name'>Match</strong>;<br>Optimal timing for crucial actions → <strong class='v2-faq-name'>Syncro</strong>;<br>Daily rhythm and energy focus → <strong class='v2-faq-name'>Atmos</strong>;<br>Complex situations too ambiguous to frame → <strong class='v2-faq-name'>Glyph</strong>.",
          },
          {
            id: "q2",
            question: "How long does an analysis take?",
            answer:
              "It varies — different situations require different analytical depth. A single delivery typically takes 3–5 minutes; some modules involve multi-round deep dives to thoroughly unpack your situation.",
          },
          {
            id: "q3",
            question: "What exactly is an Eastern OS report?",
            answer:
              "It is not a blanket verdict or unverifiable advice. You receive a structured analysis: a situational diagnostic, clear directional guidance, and actionable next steps. Every conclusion links to an expandable reasoning chain so you see why it says what it says. Final decisions remain entirely yours. <span class='v2-faq-gold'>(Note: System analyses are for decision-making reference only and do not constitute legal, medical, or financial advice.)</span>",
          },
        ],
      },
      {
        id: "during_session",
        title: "2. During Your Session",
        faqs: [
          {
            id: "q4",
            question: "Will a vague description hurt my results?",
            answer:
              "Yes. The more specific you are, the closer the analysis fits. Honestly detailing where you are stuck and what matters most allows the system to provide precise insights rather than generic advice.",
          },
          {
            id: "q5",
            question: "What do I need before I start?",
            answer:
              "Just two things: clarify the issue you want to resolve and select the corresponding module. Baseline parameters are entered once during your initial setup and apply across all modules.",
          },
          {
            id: "q6",
            question: "Can I save or export my analysis report?",
            answer:
              "Yes. Every generated report can be exported. We recommend downloading it right after generation. Since records are stored only in your local browser and won't sync across devices, exporting ensures your report stays permanently in your hands.",
          },
        ],
      },
      {
        id: "privacy_storage",
        title: "3. Privacy & Local Storage",
        faqs: [
          {
            id: "q7",
            question: "How does local storage work?",
            answer:
              "All your analysis content and history are encrypted and stored solely in your local browser — <span class='v2-faq-gold'>never uploaded to our servers.</span> Your data belongs exclusively to you.",
          },
          {
            id: "q8",
            question: "Can I access my history on another device or browser?",
            answer:
              "No. Data stays strictly local, so switching devices or browsers won't transfer past records — a deliberate privacy tradeoff. Export reports to keep them permanently. Only Pass purchases, usage logs, and remaining balances stay tied to your account.",
          },
          {
            id: "q9",
            question: "Can your servers truly not see my records?",
            answer:
              "Correct. During generation, the system processes only what is necessary in real time and delivers results immediately without retaining your content. Everything remains encrypted in your browser. There are no analysis records on our servers — <span class='v2-faq-gold'>not even we can see them.</span>",
          },
        ],
      },
      {
        id: "billing_vouchers",
        title: "4. Plans, Billing & Vouchers",
        faqs: [
          {
            id: "q10",
            question: "Do my monthly subscription allowances roll over?",
            answer:
              "No. Monthly allowances are valid within the active billing cycle, do not carry over, and reset each period. Subscriptions renew automatically at the end of each term. You can cancel anytime in Account Settings to prevent future charges.",
          },
          {
            id: "q11",
            question: "What if I run out of allowance mid-month?",
            answer:
              "You can purchase a Single Use for $9.99 anytime without waiting for the next cycle, or upgrade to a higher subscription tier.",
          },
          {
            id: "q12",
            question: "What is the difference between Single Use and Subscription?",
            answer:
              "Single Use = Pay-as-you-go, never expires after purchase, ideal for one-off needs.<br>Subscription = Cost-effective choice for frequent users, including monthly Atmos access and full-module allowances (valid monthly). Choose based on your usage frequency.",
          },
        ],
      },
      {
        id: "account_usage",
        title: "5. Account & Usage",
        faqs: [
          {
            id: "q13",
            question: "Can several people or devices share one account?",
            answer:
              "Yes. One account works across multiple devices, drawing one credit per use regardless of headcount. Everyone's records stay in their own local browser, completely private — you share the allowance, not the privacy. <span class='v2-faq-gold'>Please safeguard your credentials; all activity under the account is deemed authorized by the account owner.</span>",
          },
          {
            id: "q14",
            question: "Can I change my registered email?",
            answer:
              "Yes. You can update your email in Account Settings. Your subscription benefits and remaining Passes will seamlessly stay with your account.",
          },
          {
            id: "q15",
            question: "If I close or leave the page during generation, will I lose my credit?",
            answer:
              "No. Once initiated, processing completes in the background and delivers to your current browser, so returning to the page will display your report. Exception: If you switch browsers or devices mid-way, local storage constraints prevent syncing. If this occurs, contact <span class='v2-faq-gold'>support@easternos.com</span> for a verified Pass replenishment. <span class='v2-faq-gold'>(Note: Delivered digital products are non-refundable, but credits lost due to technical faults are fully compensated.)</span>",
          },
        ],
      },
    ],
  },
  es: {
    titleGold: "Arquitectura del Sistema",
    titleRest: "y Preguntas Frecuentes",
    subtitle:
      "Respuestas sobre el funcionamiento de Eastern OS, privacidad de datos y facturación de suscripciones.",
    categories: [
      {
        id: "product_methodology",
        title: "1. Producto y Metodología",
        faqs: [
          {
            id: "q1",
            question: "¿Qué módulos tiene Eastern OS y cómo debo elegir?",
            answer:
              "Elige según la situación a la que te enfrentes: Grandes transiciones o dilemas estancados → <strong class='v2-faq-name'>Pivot</strong>;<br>Compatibilidad entre dos personas → <strong class='v2-faq-name'>Match</strong>;<br>El momento idóneo para actuar → <strong class='v2-faq-name'>Syncro</strong>;<br>Ritmo diario y enfoque de energía → <strong class='v2-faq-name'>Atmos</strong>;<br>Situaciones complejas imposibles de formular para revelar estructuras ocultas → <strong class='v2-faq-name'>Glyph</strong>.",
          },
          {
            id: "q2",
            question: "¿Cuánto dura un análisis aproximadamente?",
            answer:
              "Varía según la persona: diferentes situaciones y preguntas requieren distintas profundidades. Una entrega individual suele tardar unos 3-5 minutos; algunos módulos avanzan progresivamente a través de varias rondas para profundizar en el asunto.",
          },
          {
            id: "q3",
            question: "¿Qué es exactamente la entrega de Eastern OS?",
            answer:
              "No es una simple conclusión ni palabras inverificables. Recibes un análisis estructurado: un diagnóstico de tu situación, una dirección clara y acciones concretas. Cada conclusión incluye una cadena de razonamiento desplegable para entender por qué lo dice. La decisión final siempre es tuya. <span class='v2-faq-gold'>(Nota: El análisis es solo una referencia y no constituye asesoramiento legal, médico o financiero.)</span>",
          },
        ],
      },
      {
        id: "during_session",
        title: "2. Consideraciones Durante la Sesión",
        faqs: [
          {
            id: "q4",
            question: "¿Afectará el resultado si mi descripción es muy vaga?",
            answer:
              "Sí. Cuanto más específico seas, más personalizado será el análisis. Explicar sinceramente dónde te encuentras bloqueado y qué te importa permite ofrecer un diagnóstico preciso en lugar de respuestas genéricas.",
          },
          {
            id: "q5",
            question: "¿Qué necesito preparar antes de comenzar?",
            answer:
              "Solo dos cosas: tener clara la duda que deseas resolver y elegir el módulo correspondiente. Los parámetros base se introducen una sola vez en el primer uso y sirven para todos los módulos.",
          },
          {
            id: "q6",
            question: "¿Puedo guardar o exportar el informe generado?",
            answer:
              "Sí. Cada informe generado se puede exportar. Te recomendamos descargarlo tras su generación. Como los datos residen solo en tu navegador local y no se sincronizan entre dispositivos, exportarlo garantiza que conserves tu informe.",
          },
        ],
      },
      {
        id: "privacy_storage",
        title: "3. Privacidad y Almacenamiento Local",
        faqs: [
          {
            id: "q7",
            question: "¿Cómo funciona el almacenamiento local?",
            answer:
              "Todo tu contenido e historial de análisis se guardan encriptados únicamente en tu navegador local, <span class='v2-faq-gold'>sin subirse a nuestros servidores.</span> Tus datos te pertenecen solo a ti.",
          },
          {
            id: "q8",
            question: "¿Podré ver el historial si cambio de dispositivo o navegador?",
            answer:
              "No. Como los datos residen solo en el navegador local, cambiar de dispositivo o navegador no sincronizará registros pasados: un compromiso deliberado con la privacidad. Exporta tus informes para conservarlos. Solo el historial de compras y saldo de Passes se vinculan a tu cuenta.",
          },
          {
            id: "q9",
            question: "¿De verdad vuestros servidores no pueden ver mis registros?",
            answer:
              "Así es. Durante la generación, el sistema procesa solo lo necesario en tiempo real y devuelve el resultado inmediatamente sin guardar nada. Todo permanece encriptado en tu navegador. No hay registros en nuestros servidores: <span class='v2-faq-gold'>ni nosotros podemos verlos.</span>",
          },
        ],
      },
      {
        id: "billing_vouchers",
        title: "4. Planes y Facturación",
        faqs: [
          {
            id: "q10",
            question: "¿Se acumulan los créditos de suscripción para el próximo mes?",
            answer:
              "No. Los créditos de suscripción se calculan mensualmente, son válidos durante el ciclo actual, no se acumulan y se reinician cada periodo. La suscripción se renueva automáticamente, pero puedes cancelarla en cualquier momento desde la configuración de tu cuenta.",
          },
          {
            id: "q11",
            question: "¿Qué hago si me quedo sin créditos a mitad de mes?",
            answer:
              "Puedes comprar un Pase Individual por $9.99 en cualquier momento sin esperar al siguiente ciclo, o actualizar a un plan de suscripción superior.",
          },
          {
            id: "q12",
            question: "¿Cuál es la diferencia entre Pase Individual y Suscripción?",
            answer:
              "Pase Individual = Pago por uso, no caduca tras la compra, ideal para resolver una necesidad puntual.<br>Suscripción = La opción más económica para uso frecuente, incluye acceso a Atmos y créditos para todos los módulos (válidos mensualmente).",
          },
        ],
      },
      {
        id: "account_usage",
        title: "5. Cuenta y Dispositivos",
        faqs: [
          {
            id: "q13",
            question: "¿Pueden varias personas o dispositivos compartir una cuenta?",
            answer:
              "Sí. Una cuenta funciona en varios dispositivos, descontando un crédito por uso sin importar el número de personas. Los registros de cada usuario se guardan únicamente en su navegador local: compartes el saldo, no tu privacidad. <span class='v2-faq-gold'>Por favor, protege tus credenciales.</span>",
          },
          {
            id: "q14",
            question: "¿Puedo cambiar el correo electrónico registrado?",
            answer:
              "Sí. Puedes actualizar tu correo en la configuración de la cuenta. Tus beneficios de suscripción y saldo de Passes permanecerán vinculados a tu cuenta.",
          },
          {
            id: "q15",
            question: "Si cierro la página mientras se genera el informe, ¿perderé mi crédito?",
            answer:
              "No. Tras iniciar la solicitud, el proceso se completa en segundo plano y se entrega en tu navegador actual. Excepción: Si cambias de navegador o dispositivo durante el proceso, la restricción del almacenamiento local impedirá ver el informe. En este caso, contacta a <span class='v2-faq-gold'>support@easternos.com</span> para restituir tu Pase. <span class='v2-faq-gold'>(Nota: Los productos digitales entregados no son reembolsables, pero se compensarán los fallos técnicos.)</span>",
          },
        ],
      },
    ],
  },
  de: {
    titleGold: "Systemarchitektur",
    titleRest: "& FAQs",
    subtitle:
      "Antworten zu Funktionsweise, Datenschutz und Abonnement-Abrechnung von Eastern OS.",
    categories: [
      {
        id: "product_methodology",
        title: "1. Produkt & Methodik",
        faqs: [
          {
            id: "q1",
            question: "Welche Module bietet Eastern OS und wie wähle ich aus?",
            answer:
              "Wählen Sie nach Ihrer aktuellen Herausforderung: Große Umbrüche oder verfahrene Situationen → <strong class='v2-faq-name'>Pivot</strong>;<br>Kompatibilität zwischen zwei Personen → <strong class='v2-faq-name'>Match</strong>;<br>Der richtige Zeitpunkt für wichtige Schritte → <strong class='v2-faq-name'>Syncro</strong>;<br>Täglicher Rhythmus und Energiefokus → <strong class='v2-faq-name'>Atmos</strong>;<br>Zu komplexe Situationen zur Formulierung, um verborgene Strukturen sichtbar zu machen → <strong class='v2-faq-name'>Glyph</strong>.",
          },
          {
            id: "q2",
            question: "Wie lange dauert eine Analyse ungefähr?",
            answer:
              "Das ist individuell: Unterschiedliche Situationen erfordern unterschiedliche Tiefe. Eine einzelne Auswertung dauert in der Regel etwa 3–5 Minuten; einige Module verlaufen über mehrere Stufen, um ein Thema Schritt für Schritt zu vertiefen.",
          },
          {
            id: "q3",
            question: "Was genau ist das Ergebnis einer Analyse bei Eastern OS?",
            answer:
              "Kein pauschales Urteil und kein unprüfbares Gerede. Sie erhalten eine strukturierte Analyse: eine Standortbestimmung, eine klare Ausrichtung und konkrete Handlungsschritte. Jede Schlussfolgerung enthält eine aufklappbare Herleitung. Die Entscheidung liegt stets bei Ihnen. <span class='v2-faq-gold'>(Hinweis: Die Analysen dienen der Orientierung und ersetzen keine juristische, medizinische oder finanzielle Beratung.)</span>",
          },
        ],
      },
      {
        id: "during_session",
        title: "2. Hinweise zur Nutzung",
        faqs: [
          {
            id: "q4",
            question: "Beeinträchtigt eine vage Beschreibung das Ergebnis?",
            answer:
              "Ja. Je spezifischer Ihre Angaben, desto genauer die Analyse. Beschreiben Sie ehrlich, wo Sie feststecken und was Ihnen wichtig ist, damit das System präzise Erkenntnisse statt pauschaler Aussagen liefert.",
          },
          {
            id: "q5",
            question: "Was muss ich vor dem Start vorbereiten?",
            answer:
              "Nur zwei Dinge: Klarheit darüber, welche Frage Sie klären möchten, und die Wahl des passenden Moduls. Die Basisparameter werden nur beim ersten Mal erfasst und gelten danach für alle Module.",
          },
          {
            id: "q6",
            question: "Kann ich den erstellten Bericht speichern oder herunterladen?",
            answer:
              "Ja. Jeder Bericht kann exportiert werden. Wir empfehlen das Herunterladen direkt nach der Erstellung. Da die Daten nur lokal im Browser gespeichert werden, ist der Export der beste Weg zur dauerhaften Sicherung.",
          },
        ],
      },
      {
        id: "privacy_storage",
        title: "3. Datenschutz & Lokaler Speicher",
        faqs: [
          {
            id: "q7",
            question: "Wie funktioniert die lokale Speicherarchitektur?",
            answer:
              "Alle Ihre Analysen und Verläufe werden ausschließlich verschlüsselt in Ihrem lokalen Browser gespeichert und <span class='v2-faq-gold'>niemals auf unsere Server hochgeladen.</span> Ihre Daten gehören allein Ihnen.",
          },
          {
            id: "q8",
            question: "Kann ich meine Historie auf einem anderen Gerät oder Browser sehen?",
            answer:
              "Nein. Da die Daten lokal gespeichert sind, werden historische Einträge nicht synchronisiert – eine gezielte Entscheidung für Ihren Datenschutz. Bitte exportieren Sie Berichte zur Aufbewahrung. Nur Ihre Pass-Käufe, Verbrauchshistorie und Ihr Guthaben sind mit dem Konto verknüpft.",
          },
          {
            id: "q9",
            question: "Können Ihre Server wirklich nicht auf meine Aufzeichnungen zugreifen?",
            answer:
              "Ja. Bei der Erstellung verarbeitet das System nur die notwendigen Daten in Echtzeit und liefert das Ergebnis sofort zurück, ohne Inhalte zu speichern. Auf unseren Servern liegen keinerlei Analysedaten – <span class='v2-faq-gold'>nicht einmal wir können sie einsehen.</span>",
          },
        ],
      },
      {
        id: "billing_vouchers",
        title: "4. Abonnements & Guthaben",
        faqs: [
          {
            id: "q10",
            question: "Werden nicht genutzte Guthaben in den nächsten Monat übertragbar?",
            answer:
              "Nein. Das Guthaben gilt jeweils für den laufenden Abrechnungszeitraum, verfällt am Ende und wird zu jedem Zyklus zurückgesetzt. Abonnements verlängern sich automatisch. Sie können das Abonnement jederzeit in den Kontoeinstellungen kündigen.",
          },
          {
            id: "q11",
            question: "Was passiert, wenn mein Guthaben im laufenden Monat aufgebraucht ist?",
            answer:
              "Sie können jederzeit einen Einzelpass für 9,99 $ erwerben oder auf einen höheren Tarif upgraden, ohne auf den nächsten Abrechnungszeitraum warten zu müssen.",
          },
          {
            id: "q12",
            question: "Was ist der Unterschied zwischen Einzelpass (Single Use) und Abonnement?",
            answer:
              "Einzelpass = Einmalig kaufen, unbegrenzt gültig (verfällt nicht), ideal für einmalige Anliegen.<br>Abonnement = Die kostengünstige Wahl für regelmäßige Nutzung inklusive monatlichem Atmos-Zugang und Guthaben für alle Module (gültig je Abrechnungsmonat).",
          },
        ],
      },
      {
        id: "account_usage",
        title: "5. Konto & Geräte",
        faqs: [
          {
            id: "q13",
            question: "Kann ein Konto von mehreren Personen oder Geräten genutzt werden?",
            answer:
              "Ja. Ein Konto kann auf mehreren Geräten verwendet werden; jede Nutzung zieht ein Guthaben ab. Die Aufzeichnungen bleiben lokal im jeweiligen Browser geschützt – Sie teilen das Guthaben, nicht Ihre Privatsphäre. <span class='v2-faq-gold'>Bitte schützen Sie Ihre Zugangsdaten.</span>",
          },
          {
            id: "q14",
            question: "Kann ich meine registrierte E-Mail-Adresse ändern?",
            answer:
              "Ja. Sie können Ihre E-Mail-Adresse in den Kontoeinstellungen ändern. Ihre Abonnements und verbleibenden Passes bleiben dem Konto zugeordnet.",
          },
          {
            id: "q15",
            question: "Geht mein Guthaben verloren, wenn ich die Seite während der Erstellung schließe?",
            answer:
              "Nein. Die Erstellung läuft im Hintergrund weiter und wird an Ihren aktuellen Browser geliefert. Ausnahme: Wechseln Sie währenddessen das Gerät oder den Browser, kann der Bericht aufgrund des lokalen Speichers nicht angezeigt werden. Wenden Sie sich in diesem Fall an <span class='v2-faq-gold'>support@easternos.com</span> zur Gutschrift des Passes. <span class='v2-faq-gold'>(Hinweis: Gelieferte digitale Inhalte sind vom Umtausch ausgeschlossen, technische Störungen werden voll kompensiert.)</span>",
          },
        ],
      },
    ],
  },
  fr: {
    titleGold: "Architecture Système",
    titleRest: "& FAQ",
    subtitle:
      "Réponses sur le fonctionnement d'Eastern OS, la confidentialité des données et la facturation des abonnements.",
    categories: [
      {
        id: "product_methodology",
        title: "1. Produit et Méthodologie",
        faqs: [
          {
            id: "q1",
            question: "Quels sont les modules d'Eastern OS et comment choisir ?",
            answer:
              "Choisissez selon votre situation : Transitions majeures ou dilemmes bloqués → <strong class='v2-faq-name'>Pivot</strong> ;<br>Compatibilité entre deux personnes → <strong class='v2-faq-name'>Match</strong> ;<br>Le moment idéal pour agir → <strong class='v2-faq-name'>Syncro</strong> ;<br>Rythme quotidien et allocation d'énergie → <strong class='v2-faq-name'>Atmos</strong> ;<br>Situations trop complexes à formuler pour révéler la structure implicite → <strong class='v2-faq-name'>Glyph</strong>.",
          },
          {
            id: "q2",
            question: "Combien de temps dure une analyse ?",
            answer:
              "Cela varie : des situations et questions différentes nécessitent des profondeurs différentes. Une analyse prend généralement 3 à 5 minutes ; certains modules se déroulent en plusieurs étapes pour approfondir le sujet.",
          },
          {
            id: "q3",
            question: "En quoi consiste exactement le rapport d'Eastern OS ?",
            answer:
              "Ni une conclusion simpliste, ni un discours invérifiable. Vous obtenez une analyse structurée : un diagnostic de votre situation, une orientation claire et des actions concrètes. Chaque conclusion s'appuie sur une chaîne de raisonnement dépliable. La décision vous appartient. <span class='v2-faq-gold'>(Note : L'analyse sert de référence et ne constitue pas un conseil juridique, médical ou financier.)</span>",
          },
        ],
      },
      {
        id: "during_session",
        title: "2. Pendant votre Session",
        faqs: [
          {
            id: "q4",
            question: "Une description floue aura-t-elle un impact sur les résultats ?",
            answer:
              "Oui. Plus vous êtes précis, plus l'analyse sera sur mesure. En expliquant honnêtement vos blocages et vos priorités, le système vous fournira une analyse ajustée plutôt que des généralités.",
          },
          {
            id: "q5",
            question: "Que dois-je préparer avant de commencer ?",
            answer:
              "Deux choses : définir clairement la question à clarifier et choisir le module correspondant. Les paramètres de base sont saisis une seule fois lors du premier usage et s'appliquent à tous les modules.",
          },
          {
            id: "q6",
            question: "Puis-je sauvegarder ou exporter le rapport généré ?",
            answer:
              "Oui. Chaque rapport peut être exporté. Nous vous conseillons de le télécharger immédiatement. Les données étant conservées uniquement dans votre navigateur local sans synchronisation, l'export garantit sa conservation.",
          },
        ],
      },
      {
        id: "privacy_storage",
        title: "3. Confidentialité & Stockage Local",
        faqs: [
          {
            id: "q7",
            question: "Comment fonctionne le stockage local ?",
            answer:
              "Vos analyses et votre historique sont chiffrés et conservés uniquement dans votre navigateur local. <span class='v2-faq-gold'>Rien n'est envoyé sur nos serveurs.</span> Vos données vous appartiennent exclusivement.",
          },
          {
            id: "q8",
            question: "Puis-je consulter mon historique sur un autre appareil ou navigateur ?",
            answer:
              "Non. Les données restent locales, donc aucun transfert n'est effectué — un choix délibéré pour votre confidentialité. Veuillez exporter vos rapports pour les conserver. Seuls l'historique d'achat et le solde de vos Passes sont liés à votre compte.",
          },
          {
            id: "q9",
            question: "Vos serveurs ne peuvent-ils vraiment pas accéder à mes données ?",
            answer:
              "Tout à fait. Lors de la génération, le système traite les données nécessaires en temps réel et renvoie le résultat sans rien conserver. Tout reste chiffré dans votre navigateur. <span class='v2-faq-gold'>Aucun historique ne réside sur nos serveurs.</span>",
          },
        ],
      },
      {
        id: "billing_vouchers",
        title: "4. Abonnements et Facturation",
        faqs: [
          {
            id: "q10",
            question: "Les crédits d'abonnement sont-ils reportés le mois suivant ?",
            answer:
              "Non. Les crédits sont mensuels, valables uniquement durant le cycle en cours et réinitialisés à chaque période. L'abonnement se renouvelle automatiquement. Vous pouvez l'annuler à tout moment dans les paramètres de votre compte.",
          },
          {
            id: "q11",
            question: "Que faire si mon solde est épuisé en cours de mois ?",
            answer:
              "Vous pouvez acheter un Pass unique à 9,99 $ à tout moment sans attendre le cycle suivant, ou passer à un abonnement supérieur.",
          },
          {
            id: "q12",
            question: "Quelle est la différence entre un Pass unique et un Abonnement ?",
            answer:
              "Pass unique = Utilisation à la carte, n'expire jamais après l'achat, idéal pour un besoin ponctuel.<br>Abonnement = L'option économique pour un usage fréquent, incluant Atmos et des crédits mensuels pour tous les modules (valables durant le mois).",
          },
        ],
      },
      {
        id: "account_usage",
        title: "5. Compte et Appareils",
        faqs: [
          {
            id: "q13",
            question: "Plusieurs personnes ou appareils peuvent-ils partager un même compte ?",
            answer:
              "Oui. Un compte peut être utilisé sur plusieurs appareils, déduisant un crédit par utilisation. Les historiques restent stricts dans chaque navigateur local — vous partagez les crédits, pas votre vie privée. <span class='v2-faq-gold'>Veillez à protéger vos identifiants.</span>",
          },
          {
            id: "q14",
            question: "Puis-je modifier l'adresse e-mail enregistrée ?",
            answer:
              "Oui. Vous pouvez mettre à jour votre adresse dans les paramètres du compte. Vos avantages et solde de Passes restent rattachés à votre compte.",
          },
          {
            id: "q15",
            question: "Si je ferme la page pendant la génération, vais-je perdre mon crédit ?",
            answer:
              "Non. La génération continue en arrière-plan et s'affiche dans votre navigateur. Exception : Si vous changez de navigateur ou d'appareil en cours de route, le rapport ne sera pas visible en raison du stockage local. Dans ce cas, contactez <span class='v2-faq-gold'>support@easternos.com</span> pour obtenir la réattribution de votre Pass. <span class='v2-faq-gold'>(Note : Les produits numériques livrés ne sont pas remboursables, mais les erreurs techniques sont entièrement compensées.)</span>",
          },
        ],
      },
    ],
  },
};
