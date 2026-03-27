const extensionName = "bazi-gacha-array";
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;

if (typeof marked === 'undefined') {
    const script = document.createElement('script');
    script.src = "https://cdn.jsdelivr.net/npm/marked/marked.min.js";
    document.head.appendChild(script);
}

let pcaData = {};
const SPECIAL_PROVS = ["香港特别行政区", "澳门特别行政区", "台湾"];
const OTHER_KEY = "海外及其他地区";

const GameDatabase = [
  {
    name: "恋与深空", keywords: ["恋与深空", "深空"],
    desc: "一款近未来幻想的3D乙女恋爱手游，提供高沉浸互动体验。主控为女性猎人小姐。",
    characters: [
      { name: "沈星回", info: "生日：10月16日，EVOL属性：光" },
      { name: "黎深", info: "生日：9月5日，EVOL属性：冰" },
      { name: "祁煜", info: "生日：3月6日，EVOL属性：火" },
      { name: "秦彻", info: "生日：4月18日，EVOL属性：能量操控" },
      { name: "夏以昼", info: "生日：6月13日，EVOL属性：引力" }
    ]
  },
  {
    name: "世界之外", keywords: ["世界之外", "世外"],
    desc: "网易开发的无限流言情手游。女性玩家扮演不同角色于副本中完成任务，体验超越现实的甜蜜爱恋。",
    characters: [
      { name: "顾时夜", info: "生日：11月22日" },
      { name: "易遇", info: "生日：12月31日" },
      { name: "柏源", info: "生日：4月15日" },
      { name: "夏萧因", info: "生日：9月10日" }
    ]
  },
  {
    name: "无限暖暖", keywords: ["无限暖暖", "暖暖"],
    desc: "暖暖系列第五代作品，一款多平台开放世界换装冒险游戏，玩家将与大喵在奇迹大陆探索解谜。",
    characters: [
      { name: "苏暖暖", info: "生日：12月6日" },
      { name: "暖暖", info: "生日：12月6日" }
    ]
  }
];

function extractGameContext(wishText) {
  let injectedContext = "";
  GameDatabase.forEach(game => {
    let isGameMentioned = game.keywords.some(kw => wishText.includes(kw));
    let mentionedChars = game.characters.filter(c => wishText.includes(c.name));
    if (isGameMentioned || mentionedChars.length > 0) {
      injectedContext += `\n【系统注入补充资料：${game.name}】\n游戏简介：${game.desc}\n相关角色信息：\n`;
      let printedInfos = new Set();
      let targetChars = (isGameMentioned && mentionedChars.length === 0) ? game.characters : mentionedChars;
      targetChars.forEach(c => {
        if (!printedInfos.has(c.info)) {
          injectedContext += `- ${c.name}: ${c.info}\n`;
          printedInfos.add(c.info);
        }
      });
    }
  });
  return injectedContext;
}

jQuery(async () => {
    const uiHtml = await $.get(`${extensionFolderPath}/bazi_ui.html`);
    $("#extensions_settings").append(uiHtml);

    const modalHtml = await $.get(`${extensionFolderPath}/bazi_modal.html`);
    $("body").append(modalHtml);

    $("#bazi_open_modal_btn").on("click", () => {
        $("#bazi_modal_container").css('display', 'flex').hide().fadeIn('fast');
    });
    $("#bazi_modal_close").on("click", () => {
        $("#bazi_modal_container").fadeOut('fast');
    });
    $("#bazi_modal_container").on("click", function(e) {
        if (e.target === this) $(this).fadeOut('fast');
    });

    // 恢复本地存储：增加 use_st_api
    const savedUseStApi = localStorage.getItem('bazi_use_st_api');
    if (savedUseStApi !== null) {
        $('#bazi_use_st_api').prop('checked', savedUseStApi === 'true');
    }
    toggleCustomApiBlock();

    $('#bazi_use_st_api').on('change', toggleCustomApiBlock);

    $('#bazi_apiUrl').val(localStorage.getItem('bazi_api_url') || '');
    $('#bazi_apiKey').val(localStorage.getItem('bazi_api_key') || '');
    if(localStorage.getItem('bazi_api_model')) $('#bazi_modelInput').val(localStorage.getItem('bazi_api_model'));
    if(localStorage.getItem('bazi_gender')) $('#bazi_gender').val(localStorage.getItem('bazi_gender'));
    if(localStorage.getItem('bazi_birthday')) $('#bazi_birthday').val(localStorage.getItem('bazi_birthday'));

    try {
        const res = await fetch('https://cdn.jsdelivr.net/gh/modood/Administrative-divisions-of-China/dist/pca.json');
        const rawData = await res.json();
        let orderedData = {};
        for (let prov in rawData) {
            if (!SPECIAL_PROVS.includes(prov)) orderedData[prov] = rawData[prov];
        }
        SPECIAL_PROVS.forEach(sp => { orderedData[sp] = "special"; });
        orderedData[OTHER_KEY] = "other";
        pcaData = orderedData;
        $('#bazi_birth-loading').text(""); 
    } catch (e) {
        pcaData = {}; 
        SPECIAL_PROVS.forEach(sp => { pcaData[sp] = "special"; });
        pcaData[OTHER_KEY] = "other";
        $('#bazi_birth-loading').text("(离线)"); 
    }

    setupLocationGroup('bazi_birth');
    setupLocationGroup('bazi_live');

    $('#bazi_sendBtn').on('click', sendRequest);
});

function toggleCustomApiBlock() {
    if ($('#bazi_use_st_api').is(':checked')) {
        $('#bazi_custom_api_block').slideUp('fast');
    } else {
        $('#bazi_custom_api_block').slideDown('fast');
    }
}

function setupLocationGroup(prefix) {
    const group = $(`#${prefix}-group`);
    const provSelect = group.find('.prov');
    provSelect.empty().append('<option value="">请选择省份</option>');
    for (let prov in pcaData) provSelect.append(new Option(prov, prov));
    
    provSelect.on('change', () => updateCity(prefix));
    group.find('.city').on('change', () => updateDist(prefix));
}

function updateCity(prefix) {
    const group = $(`#${prefix}-group`);
    const prov = group.find('.prov').val();
    const citySelect = group.find('.city');
    const distSelect = group.find('.dist');
    const otherInput = group.find('.other');
    
    citySelect.empty().append('<option value="">请选择城市</option>');
    distSelect.empty().append('<option value="">请选择区县</option>');
    
    if (!prov) {
        citySelect.show(); distSelect.show(); otherInput.hide(); return;
    }
    if (prov === OTHER_KEY) {
        citySelect.hide(); distSelect.hide(); otherInput.show();
    } else if (SPECIAL_PROVS.includes(prov) || pcaData[prov] === "special") {
        citySelect.hide(); distSelect.hide(); otherInput.hide();
    } else {
        citySelect.show(); distSelect.show(); otherInput.hide();
        for (let c in pcaData[prov]) citySelect.append(new Option(c, c));
    }
}

function updateDist(prefix) {
    const group = $(`#${prefix}-group`);
    const prov = group.find('.prov').val();
    const city = group.find('.city').val();
    const distSelect = group.find('.dist');
    distSelect.empty().append('<option value="">请选择区县</option>');
    if(city && pcaData[prov] && pcaData[prov][city]) {
        pcaData[prov][city].forEach(d => distSelect.append(new Option(d, d)));
    }
}

function getLocationString(prefix) {
    const group = $(`#${prefix}-group`);
    const prov = group.find('.prov').val();
    if (!prov) return "";
    if (prov === OTHER_KEY) return group.find('.other').val().trim();
    if (SPECIAL_PROVS.includes(prov)) return prov;
    const city = group.find('.city').val();
    const dist = group.find('.dist').val();
    return `${prov}${city}${dist}`;
}

async function sendRequest() {
    const useStApi = $('#bazi_use_st_api').is(':checked');
    const apiUrl = $('#bazi_apiUrl').val().trim();
    const apiKey = $('#bazi_apiKey').val().trim();
    const modelName = $('#bazi_modelInput').val(); 
    
    const gender = $('#bazi_gender').val();
    const birthday = $('#bazi_birthday').val();
    let birthTime = $('#bazi_birthTime').val().trim();
    const birthPlace = getLocationString('bazi_birth');
    const livePlace = getLocationString('bazi_live');
    const wish = $('#bazi_wish').val().trim();
    const btn = $('#bazi_sendBtn');

    if(!useStApi && (!apiUrl || !apiKey || !modelName)) return alert("请填写自定义 API 配置，或勾选使用酒馆主 API！");
    if(!birthday) return alert("请选择阳历生日！");
    if(!birthPlace || !livePlace) return alert("请完整填写出生地和现居地！");
    if(!wish) return alert("请填写您的心愿！");
    if(!birthTime) birthTime = "任选当天吉时";

    localStorage.setItem('bazi_use_st_api', useStApi);
    localStorage.setItem('bazi_api_url', apiUrl);
    localStorage.setItem('bazi_api_key', apiKey);
    localStorage.setItem('bazi_api_model', modelName);
    localStorage.setItem('bazi_gender', gender);
    localStorage.setItem('bazi_birthday', birthday);

    const systemPrompt = `你现在是一个中国传统八字命理的专业研究人员，你熟读穷通宝典、三命通会、滴天髓、渊海子平这些书籍。你熟读千里命稿、协纪辨方书、果老星宗、子平真栓、神峰通考等一系列书籍。根据“排大运分阳年、阴年。阳年：甲丙戊庚壬。阴年：乙丁己辛癸。阳年男，阴年女为顺排，阴年男，阳年女为逆排。具体排法以月干支为基准，进行顺逆。小孩交大运前，以月柱干支为大运十天干：甲乙丙丁戊己庚辛壬癸，十二地支：子丑寅卯辰巳午未申酉戌亥。`;

    const gameInfo = extractGameContext(wish);

    const userPrompt = `下面是要根据用户输入组合的信息：
用户阳历生日是：${birthday}
出生时间是：${birthTime}
出生在：${birthPlace}
现住：${livePlace}
性别：${gender}。
${gameInfo}

请你以一个专业四柱八字研究者的角色，根据以上用户所提到的书籍，及相关四柱八字的书籍和经验，学习一下，具体在什么时间，在用户家里，朝向哪方，口号什么的，根据常见谷子五行分类（棉花娃娃，马口铁吧唧，亚克力立牌，纸质镭射票等）如何利用元素相关谷子摆阵，能让【${wish}】比较欧？

【大师测算准则】
1. 时辰和朝向必须反复测算五次，确保正确无误。
2. 口号必须结合愿望，不能太俗，避免生僻字，必须简洁好记。
3. 如果遇到抽卡歪卡等突发情况，请在总结中提供调整方案。
4. 详细步骤中，允许使用 Markdown 格式（如加粗、列表、标题等）来优化排版，让用户一目了然。

请必须以严格的 JSON 格式返回结果：
{
  "summary": "一句话总结（如：明日午时面朝东南大喊xx口号，歪卡调整方案等）",
  "details": "具体的执行步骤、详细解释（包括八字简析、时间、方位、阵法摆放等）"
}`;

    const finalPrompt = systemPrompt + "\n\n" + userPrompt;

    btn.text("盘算中，请稍候...").prop('disabled', true);
    $('#bazi_summary-content, #bazi_details-content').html("加载中...");

    try {
        let aiContentString = "";

        if (useStApi) {
            // 调用酒馆内部生成接口
            const { generateRaw } = SillyTavern.getContext();
            aiContentString = await generateRaw({
                systemPrompt: systemPrompt,
                prompt: userPrompt
            });
            if (!aiContentString) throw new Error("酒馆 API 返回空值，请检查当前主 API 连接状态。");
        } else {
            // 调用独立第二 API
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                body: JSON.stringify({
                    model: modelName, 
                    messages: [
                        {"role": "system", "content": systemPrompt},
                        {"role": "user", "content": userPrompt}
                    ],
                    response_format: { type: "json_object" } 
                })
            });

            if (!response.ok) throw new Error(`API 报错 (状态码 ${response.status}): ${await response.text()}`);
            const data = await response.json();
            aiContentString = data.choices[0].message.content;
        }

        aiContentString = aiContentString.replace(/```json/gi, '').replace(/```/g, '').trim();
        
        try {
            const aiResult = JSON.parse(aiContentString);
            if (typeof marked !== 'undefined') {
                $('#bazi_summary-content').html(marked.parse(aiResult.summary || "未获取到总结"));
                $('#bazi_details-content').html(marked.parse(aiResult.details || "未获取到详细内容"));
            } else {
                $('#bazi_summary-content').text(aiResult.summary);
                $('#bazi_details-content').text(aiResult.details);
            }
        } catch (parseError) {
            $('#bazi_summary-content').html("⚠️ 模型未能返回标准 JSON");
            $('#bazi_details-content').html(typeof marked !== 'undefined' ? marked.parse(aiContentString) : aiContentString);
        }

    } catch (error) {
        console.error(error);
        $('#bazi_summary-content').html("请求失败");
        $('#bazi_details-content').html(error.message);
    } finally {
        btn.text("🙏 结印排盘，生成专属欧气阵法").prop('disabled', false);
    }
}
