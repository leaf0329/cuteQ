# cuteQ · 大肥鱼桌宠

Windows x64 桌面伙伴，支持本机语音输入、文字应答与持续记忆。当前为 **0.4 统一形象融合版**：保留自己的角色外形与原有动作，参考 [PC2005-cloud/dsh-pet](https://github.com/PC2005-cloud/dsh-pet) 的动作设计与视频播放方式，新增魔方和行礼。

<img src="assets/whale-video/portrait.png" alt="cuteQ 蓝发鲸鱼娘" width="240">

[下载最新版](https://github.com/leaf0329/cuteQ/releases/tag/v0.4.0) · [使用说明](使用说明.md) · [动作与验收](docs/融合说明.md) · [版本与归档](docs/版本与归档.md)

## 当前能力

- 对她说话：本机 SenseVoice 转写，支持直接交谈或“听我自言自语”；回复先用文字呈现。
- 共同记忆：独立角色后台保存对话与长期记忆，支持查看来源、修改和删除。未来桌面与 QQ 可连接同一后台；QQ 适配器尚未实现。
- 安静陪伴：20 个手动互动入口、37 个透明视频、42 个动作与过渡状态；饭团约 25 秒、魔方约 25 秒，主动活动保持低频。
- 全部运行画面采用本项目已有原画和同形象新绘素材。两个视频元素预备解码，减少启动预载与换动作停顿。帧间补间仍可能有美术限制。

## 运行

在 [Releases](https://github.com/leaf0329/cuteQ/releases) 下载便携版 EXE 或安装包。升级前从托盘退出旧版，个人设置和共同记忆保存在应用数据目录。

源码开发需要 Windows x64、Node.js 24+：

```powershell
git clone --depth 1 --single-branch --no-tags https://github.com/leaf0329/cuteQ.git
cd cuteQ
npm ci
npm run speech:prepare
npm start
```

模型地址、模型名和 API Key 在应用设置内填写；收费模型只接收转写文字及相关记忆，原始音频在本机处理。麦克风默认关闭。真实模型效果、实际口音和长期陪伴质量仍需个人试用。

## 版本快照

| 轮次 | 内容 | 下载与记录 |
| --- | --- | --- |
| 0.1 | 本机语音、独立后台与共同记忆 | [v0.1.0](https://github.com/leaf0329/cuteQ/releases/tag/v0.1.0) |
| 0.2 | 原画重绘、连续帧与安静节奏 | [v0.2.0](https://github.com/leaf0329/cuteQ/releases/tag/v0.2.0) |
| 0.3 | dsh-pet 透明视频素材比较版 | [v0.3.0](https://github.com/leaf0329/cuteQ/releases/tag/v0.3.0) |
| 0.4 | 统一形象、视频播放、魔方与行礼 | [v0.4.0](https://github.com/leaf0329/cuteQ/releases/tag/v0.4.0) |

0.1～0.3 的提交从对应安装包恢复运行时源码，提交日期是本次整理日期；没有虚构原开发提交。旧构建脚本、原画、中间帧和验收材料存放于 0.4 Release 的归档附件。main 与本地工作目录只保留当前开发所需内容，后续以 Git 提交、版本标签和 Releases 留下更新快照。

## 来源与许可

基于 **YunYueSama** 的 [codex-deepseek-pet](https://github.com/YunYueSama/codex-deepseek-pet) 修改，上游起点为 7661c8b。修改包括语音、角色后台、持续记忆、动作重绘、安静调度和视频播放。本项目与 DeepSeek 官方及上游作者没有官方合作关系。

保留完整 [大肥鱼项目署名许可 1.0](LICENSE)、[素材许可](ASSET_LICENSE.md) 与 [NOTICE](NOTICE.md)。本仓库整体不能简单视作 MIT；第三方动画和参考图片有各自边界。0.3 使用的 dsh-pet 动画素材禁止商用，衍生介绍、展示与分发需附 [PC2005-cloud/dsh-pet](https://github.com/PC2005-cloud/dsh-pet) 地址，详见其 [完整说明](assets/dsh-pet/UPSTREAM-README.md)。当前 0.4 不播放其角色成片。

原作者及授权尚未核实的社区参考原图不在公开仓库或归档中。密钥、个人记忆、录音、依赖缓存和语音模型不提交 Git；语音模型通过准备命令下载。
