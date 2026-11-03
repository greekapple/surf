# Parked workflows

`validate.yml` is the daily validation workflow (T-090). GitHub refused it because the local token lacks the `workflow` scope.
To enable: run `gh auth refresh -s workflow`, then `git mv tools/ci/validate.yml .github/workflows/validate.yml`, commit and upload.
