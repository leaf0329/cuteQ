# cuteQ 修改说明

本项目基于大肥鱼桌宠修改，增加了独立角色后台、持久记忆、本地语音输入及相关管理界面。

原作者：YunYueSama  
原仓库：https://github.com/YunYueSama/codex-deepseek-pet

原有源代码和素材遵守随附的 LICENSE、ASSET_LICENSE.md。cuteQ 的修改不代表原作者或 DeepSeek 官方认可。

本地识别使用 sherpa-onnx（Apache-2.0），模型与原项目声明见资源下载来源。sherpa-onnx 依赖的第三方组件保持各自许可。语音模型下载来源：

- https://github.com/k2-fsa/sherpa-onnx/releases/tag/asr-models
- https://github.com/FunAudioLLM/SenseVoice
- https://github.com/snakers4/silero-vad

动画新增原画使用内置 image_gen 生成，保存于 design/sources/calm-v1 与 design/sources/redraw-v2。构建阶段使用 RIFE ncnn Vulkan 生成连续中间帧（MIT；https://github.com/nihui/rife-ncnn-vulkan），工具与模型仅用于本机制作，不作为桌宠运行依赖。


cuteQ 0.3 的运行时动画来自 PC2005-cloud/dsh-pet：
https://github.com/PC2005-cloud/dsh-pet
固定素材版本：48007b64ac0bebb2e97ac88344aed62de8399dd4。上游代码为 MIT；动画/提示词/源视频另按 README 的非商业与二创署名条款使用。本次复用动画文件，保留上游完整 README 和代码许可；cuteQ 仍使用自己的语音、后台、记忆与低频行为调度。逐文件来源及未使用素材见 assets/dsh-pet/SOURCE.md 与 SOURCE.json。


cuteQ 0.4 为统一形象融合版，撤下 0.3 直接播放 dsh-pet 角色视频的方式。当前全部运行画面来自本项目此前制作的原画，以及按相同形象新绘的魔方和行礼。动作设计与双视频预备播放思路参考 PC2005-cloud/dsh-pet（https://github.com/PC2005-cloud/dsh-pet）。新增原图、提示词和制作方式见 design/sources/fusion-v4/；透明视频由已有 FFmpeg 7.1 / libvpx-vp9 在构建阶段制作，FFmpeg 不随桌宠运行。0.3 的原始素材、来源记录及独立安装包存于 https://github.com/leaf0329/cuteQ/releases/tag/v0.3.0 ；本地仅保留来源说明。
