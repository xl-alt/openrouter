const express = require("express");
var request = require("request");
var bodyParser = require("body-parser");
const { encode, decode } = require('gpt-3-encoder');
// 创建一个Express应用实例
const app = express();
// 定义端口号
// app.use(express.json());
app.use(bodyParser.json({ limit: "10mb" }));
app.use(bodyParser.urlencoded({ limit: "10mb", extended: true }));
const PORT = 3000;
app.get("/", (req, res) => {
    res.send("欢迎来到Node.js Express应用！");
});

// 随机谷歌账户
function isJsonString(str) {
    try {
        JSON.parse(str);
        return true;
    } catch (e) {
        return false;
    }
}


async function formatMessages(messages) {
    // 过滤掉 role 为 system 的消息
    const filteredMessages = messages.filter(
        (message) => message.role !== "system",
    );

    // 格式化剩余的消息
    const formattedMessages = filteredMessages.map(
        (message) => `${message.role}: ${message.content}`,
    );

    // 拼接所有消息
    return formattedMessages.join("\n");
}

function getLastSystemContent(data) {
    let lastSystemMessage = null;
    for (let message of data.messages) {
        if (message.role === "system") {
            lastSystemMessage = message.content;
        }
    }
    return lastSystemMessage; // Returns the last system message, or null if none found
}
// 开始处理数据
app.post("/v1/chat/completions", async (req, res) => {
    let databody = req.body
    let index = 0;
    databody.messages.forEach(element => {
        if (element && element != "" && element != undefined && !databody.model.includes('vision')) {
            index += encode(JSON.stringify(element.content)).length;
        }
    });
    let model = "openai/gpt-4o-mini"
    if(databody.model.includes("3.5") || databody.model.includes("mini")) {
        model = "openai/gpt-4o-mini"
    }else{
        model = databody.model
    }
    let authHeader = req.headers['authorization'];
    if (authHeader && authHeader.includes("Bearer")) {
        authHeader = authHeader.split("Bearer ")[1];
    }
    const options = {
        url: "https://openrouter.ai/api/v1/chat/completions",
        method: "POST",
        headers: {
            "Authorization": `Bearer ${authHeader}`,
            "HTTP-Referer": `openrouter.ai`, // Optional, for including your app on openrouter.ai rankings.
            "X-Title": `openrouter.ai`, // Optional. Shows in rankings on openrouter.ai.
            "Content-Type": "application/json"
        },
        json: {
            "messages": databody.messages,
            "stream": true,
            "model": model,
            "temperature": 0.5,
            "top_p": 1,
            "top_k": 5
        }
        
    };
    // console.log(options)
    let nonstr = ""
    // getPOST(formatted, token)
    const proxyReq = request(options);
    proxyReq.on("response", function (response) {
        response.on("data", (chunk) => {
            let message = `${chunk.toString()}`
            if(message.includes("openrouter")) {
                return
            }
            message = message.split(/data: |OPENROUTER PROCESSING/)
            message.forEach(element => {
                if (isJsonString(element) && JSON.parse(element).choices && JSON.parse(element).choices[0] && JSON.parse(element).choices[0].delta.content && JSON.parse(element).choices[0].delta.content != undefined) {
                    let sendstr = JSON.parse(element).choices[0].delta.content
                    nonstr += sendstr
                    if (databody.stream == true) {
                        res.write(`data: {"id":"chatcmpl-9709rQdvMSIASrvcWGVsJMQouP2UV","object":"chat.completion.chunk","created":${Math.floor(Date.now() / 1000)},"model":"${databody.model}","system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{"content":${JSON.stringify(sendstr)}},"logprobs":null,"finish_reason":null}]} \n\n`)
                    }
                }
            });
        });
        response.on("end", () => {
            if (!databody.stream || databody.stream != true) {
                res.json({
                    id: "chatcmpl-8Tos2WZQfPdBaccpgMkasGxtQfJtq",
                    object: "chat.completion",
                    created: Math.floor(Date.now() / 1000),
                    model: databody.model,
                    choices: [
                        {
                            index: 0,
                            message: {
                                role: "assistant",
                                content: nonstr,
                            },
                            finish_reason: "stop",
                        },
                    ],
                    usage: {
                        prompt_tokens: index,
                        completion_tokens: encode(nonstr).length,
                        total_tokens: index + encode(nonstr).length,
                    },
                    system_fingerprint: null,
                });
                res.end();
                return;
            }
            res.write(
                `data: {"id":"chatcmpl-89CvUKf0C36wUexKrTrmhf5tTEnEw","object":"chat.completion.chunk","model":"${databody.model}","created":${Math.floor(
                    Date.now() / 1000,
                )},"choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n\n`,
            );
            res.write(`data: [DONE]\n`);
            res.end();
        });
    });
    proxyReq.on("error", function (error) {
        // 在这里打印错误日志
        // console.error("请求出错:", error);
        // res.end()
        // 向客户端发送错误响应
        res.status(500).send("代理请求出错");
    });
});

app.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
});
