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
