# 当前动作原画与提示词

全部新增原画使用本会话内置 `image_gen` 生成，以现有蓝发鲸鱼女仆角色为参考。当前实际使用的原图和提示词随源码保存。魔方与行礼见 [fusion-v4](fusion-v4/README.md)；图标原图见 hq-v5/app-icon-redraw.png。目录名沿用来源批次，它们仍用于当前版本。

| 素材 | 实际使用的原图 | 提示词 |
| --- | --- | --- |
| 待机、拿饭团、举起、咬下、最后一口、吞咽、微笑 | [calm-v1](calm-v1/) 中的 10 张动作 PNG，另存最初参考图 | [prompts.json](calm-v1/prompts.json) |
| 挥手 | [wave-sheet.png](redraw-v2/wave-sheet.png) | [wave-prompt.txt](redraw-v2/wave-prompt.txt) |
| 思考、合书、看书、翻页 | [reading-sheet.png](redraw-v2/reading-sheet.png) | [reading-prompt.txt](redraw-v2/reading-prompt.txt) |
| 得意、抗议、委屈、道歉 | [emotion-a-sheet.png](redraw-v2/emotion-a-sheet.png) | [emotion-a-prompt.txt](redraw-v2/emotion-a-prompt.txt) |
| 惊讶、震惊、鼓腮、满足 | [emotion-b-sheet.png](redraw-v2/emotion-b-sheet.png) | [emotion-b-prompt.txt](redraw-v2/emotion-b-prompt.txt) |
| 伸展、安定、尾巴轻摆 | [micro-sheet.png](redraw-v2/micro-sheet.png) | [micro-prompt.txt](redraw-v2/micro-prompt.txt) |
| 蓄力、腾空、着地 | [jump-sheet.png](redraw-v2/jump-sheet.png) | [jump-prompt.txt](redraw-v2/jump-prompt.txt) |
| 步态 | [walk-sheet.png](redraw-v2/walk-sheet.png) | [初始要求](redraw-v2/walk-prompt.txt)、[最终修正](redraw-v2/walk-fixed-prompt.txt) |
| 步态补绘 | [walk-mid-sheet.png](refine-v3/walk-mid-sheet.png) | [walk-mid-prompt.txt](refine-v3/walk-mid-prompt.txt) |
| 饭团靠近嘴边、吃完放下空手 | [rice-under-chin.png](refine-v3/rice-under-chin.png)、[empty-hands-lowering.png](refine-v3/empty-hands-lowering.png) | [eat-single-prompts.json](refine-v3/eat-single-prompts.json) |
| 打哈欠、坐下、闭眼 | [sleep-sheet.png](redraw-v2/sleep-sheet.png) | [sleep-prompt.txt](redraw-v2/sleep-prompt.txt) |
| 正面转向侧面 | [turn-sheet.png](redraw-v2/turn-sheet.png) | [初始要求](redraw-v2/turn-prompt.txt)、[最终修正](redraw-v2/turn-fixed-prompt.txt) |
| 小幅摆动、哼歌 | [dance-sheet.png](redraw-v2/dance-sheet.png) | [dance-prompt.txt](redraw-v2/dance-prompt.txt) |
| 惦记零食、伸手拿饭团 | [sneak-sheet.png](redraw-v2/sneak-sheet.png) | [sneak-prompt.txt](redraw-v2/sneak-prompt.txt) |

四格原图按完整连通轮廓提取，避免邻格鞋尖或发梢混入。普通手部动作固定未参与动作的头发、脸型和脚底；转身、步行、跳跃、坐下使用完整身体原画。吃饭结尾使用空手画面。

`calm-v1/hold.png` 是最初保留的母图，`identity-reference.png` 是当时的角色参考；该目录的提示词索引记录母图之后的编辑请求。

透明中间帧由 [RIFE ncnn Vulkan](https://github.com/nihui/rife-ncnn-vulkan) 在构建阶段制作。黑、白底分别补帧后恢复透明度，不用运行时的双图淡化模拟肢体运动。制作中间帧写入 assets/whale/painted-*.png，归档后可清理；当前运行资产为 assets/whale-video/ 中的 384×384 透明视频，时序见 design/animation-source.cjs 与 fusion-motion.cjs。

若要重新制作全部资产，将官方 Windows 20221029 版本的程序、`rife-v4.6/` 模型与运行库置于 `tmp/rife/rife-ncnn-vulkan-20221029-windows/`，再运行 `npm run assets:painted`。桌宠启动和打包不需要该制作工具。

许可及署名继续遵守 [ASSET_LICENSE.md](../../ASSET_LICENSE.md) 与 [NOTICE.md](../../NOTICE.md)。原画生成不代表底层参考作品的权利扩大。
