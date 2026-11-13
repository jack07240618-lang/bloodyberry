# 项目协作约定

- 用户指定的永久试玩地址为 https://jack07240618-lang.github.io/bloodyberry/ 。每次完成功能修改或修复并通过必要验证后，默认提交代码并同步发布至此地址，无需重复询问发布许可。
- 发布前运行 `npm run test:balance`、`npm run test:combat` 和 `npm run build`。
- 保留 Git 历史与削弱前标签 `backup/pre-nerf-2026-11-09`，不强制推送、不覆盖已有版本历史。
- 当前 GitHub Pages 使用 GitHub Actions 部署：向 `master` 推送会触发 `.github/workflows/deploy.yml`。以工作流结果和线上 `version.json` 的提交号确认发布成功，不能只以推送成功作为完成依据。
- 独立读取与搜索尽量合并，限制日志输出；必要验证通过后及时交付。
- **美术风格基线锁定**：整个游戏的美术风格、光影规范、色彩体系与 UI 审美已总结沉淀于 [ART_STYLE.md](file:///Users/liangdongqchen/Downloads/Bloodyberry/ART_STYLE.md)。今后凡未明确要求同步或修改美术风格时，必须严格参照 `ART_STYLE.md` 的规范执行，不得擅自更改现有视觉语言。
