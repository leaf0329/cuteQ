# cuteQ 0.4 融合素材

保留 cuteQ 自有统一形象，借鉴 [PC2005-cloud/dsh-pet](https://github.com/PC2005-cloud/dsh-pet) 的魔方与女仆行礼动作设计、持物停留及视频播放方式。正式桌宠不混播该项目的角色视频。

identity.png 为现有 calm-core 第一格，用于锁定角色外观。新增画面使用内置 image_gen 生成，保留原图与提示词；不使用收费 API 脚本。编码使用已有 FFmpeg 7.1；插帧使用原有 RIFE 制作流程，运行时仅播放成品。

## 已保存文件

- identity.png：现有原画参考，锁定造型。
- cube-sheet.png：内置 image_gen 生成的四格魔方原图。
- curtsy-sheet.png：内置 image_gen 生成的四格行礼原图。
- [prompts.json](prompts.json)：两次生成的完整提示词。
- 加工后关键图：assets/whale/fusion-cube.png、fusion-curtsy.png。
- 成品：assets/whale-video/own-cube.webm、own-curtsy.webm。

构建命令：npm run assets:fusion。原图没有覆盖，首次输出保留在 Codex generated_images 目录，同时已复制到项目。没有调用 OpenAI API CLI；使用内置工具生成。
