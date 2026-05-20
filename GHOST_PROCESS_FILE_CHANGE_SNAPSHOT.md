# GHOST PROCESS FILE CHANGE SNAPSHOT

Generated: 2026-05-18 23:50:43 -03:00
Working dir: E:\GSentinelHealthOS

## Command: pwd
```

Path
----
E:\GSentinelHealthOS


```
## Command: git status --short --untracked-files=all
```
 M .claude/settings.local.json
 D Panel-SuperAdmin/.runtime/super-admin-credentials.json
 M Panel-SuperAdmin/src/services/system-health/health.client.ts
 M medical-agenda-saas/src/chat/chat.service.ts
 M medical-agenda-saas/src/lib/brain-client.ts
?? GHOST_PROCESS_FILE_CHANGE_SNAPSHOT.md
?? MB_CHAT_FULL_CLINICAL_FAILURE_AUDIT.md
?? medical-agenda-saas/src/chat/doctor-clinical-contract.ts
?? medical-agenda-saas/tests/unit/doctor-clinical-contract.test.ts
?? medical-agenda-saas/tests/whatsapp/clinical-notifier-dryrun.test.ts
?? medical-agenda-saas/tests/whatsapp/clinical-notifier-isolation.test.ts

```
## Command: git diff --name-status
```
M	.claude/settings.local.json
D	Panel-SuperAdmin/.runtime/super-admin-credentials.json
M	Panel-SuperAdmin/src/services/system-health/health.client.ts
M	medical-agenda-saas/src/chat/chat.service.ts
M	medical-agenda-saas/src/lib/brain-client.ts

```
## Command: git diff --stat
```
 .claude/settings.local.json                        |   4 +-
 .../.runtime/super-admin-credentials.json          |   6 -
 .../src/services/system-health/health.client.ts    |   4 +-
 medical-agenda-saas/src/chat/chat.service.ts       | 142 +++++++++++++++++----
 medical-agenda-saas/src/lib/brain-client.ts        |  18 +++
 5 files changed, 140 insertions(+), 34 deletions(-)

```
## Filesystem tail (latest 100 files by LastWriteTime) for MB-Chat MB-Secretaria MB-Whatsapp
```
2026-05-17 19:30:28.3617620 E:\GSentinelHealthOS\MB-Chat\review_py\__pycache__\review_escalation.cpython-314.pyc
2026-05-17 19:30:28.3637765 E:\GSentinelHealthOS\MB-Chat\review_py\__pycache__\review_flags.cpython-314.pyc
2026-05-17 19:30:28.3657883 E:\GSentinelHealthOS\MB-Chat\review_py\__pycache__\review_policy.cpython-314.pyc
2026-05-17 19:30:28.3678030 E:\GSentinelHealthOS\MB-Chat\review_py\__pycache__\review_queue.cpython-314.pyc
2026-05-17 19:30:28.3698170 E:\GSentinelHealthOS\MB-Chat\review_py\__pycache__\review_reasons.cpython-314.pyc
2026-05-17 19:30:28.3715715 E:\GSentinelHealthOS\MB-Chat\review_py\__pycache__\review_risk.cpython-314.pyc
2026-05-17 19:30:28.3735818 E:\GSentinelHealthOS\MB-Chat\review_py\__pycache__\review_routing.cpython-314.pyc
2026-05-17 19:30:28.3755955 E:\GSentinelHealthOS\MB-Chat\review_py\__pycache__\review_status.cpython-314.pyc
2026-05-17 19:30:28.3776086 E:\GSentinelHealthOS\MB-Chat\review_py\__pycache__\types.cpython-314.pyc
2026-05-17 19:30:28.3796215 E:\GSentinelHealthOS\MB-Chat\rules\__pycache__\__init__.cpython-314.pyc
2026-05-17 19:30:28.3796215 E:\GSentinelHealthOS\MB-Chat\risk\__pycache__\__init__.cpython-314.pyc
2026-05-17 19:30:28.3874042 E:\GSentinelHealthOS\MB-Chat\scripts\__pycache__\analyze_features.cpython-314.pyc
2026-05-17 19:30:28.4027891 E:\GSentinelHealthOS\MB-Chat\scripts\__pycache__\build_sequence_dataset.cpython-314.pyc
2026-05-17 19:30:28.4160586 E:\GSentinelHealthOS\MB-Chat\scripts\__pycache__\data_pipeline.cpython-314.pyc
2026-05-17 19:30:28.4257689 E:\GSentinelHealthOS\MB-Chat\scripts\__pycache__\demo_model_registry.cpython-314.pyc
2026-05-17 19:30:28.4297894 E:\GSentinelHealthOS\MB-Chat\scripts\__pycache__\extract_real_dataset.cpython-314.pyc
2026-05-17 19:30:28.4378332 E:\GSentinelHealthOS\MB-Chat\scripts\__pycache__\feature_selection.cpython-314.pyc
2026-05-17 19:30:28.4438588 E:\GSentinelHealthOS\MB-Chat\scripts\__pycache__\generate_synthetic_data.cpython-314.pyc
2026-05-17 19:30:28.4496234 E:\GSentinelHealthOS\MB-Chat\scripts\__pycache__\model_compare.cpython-314.pyc
2026-05-17 19:30:28.4556455 E:\GSentinelHealthOS\MB-Chat\scripts\__pycache__\model_monitor.cpython-314.pyc
2026-05-17 19:30:28.4617099 E:\GSentinelHealthOS\MB-Chat\scripts\__pycache__\model_registry.cpython-314.pyc
2026-05-17 19:30:28.4674698 E:\GSentinelHealthOS\MB-Chat\scripts\__pycache__\model_rollback.cpython-314.pyc
2026-05-17 19:30:28.4694778 E:\GSentinelHealthOS\MB-Chat\scripts\__pycache__\run_ml_validation.cpython-314.pyc
2026-05-17 19:30:28.4734922 E:\GSentinelHealthOS\MB-Chat\scripts\__pycache__\traffic_shadow_real_check.cpython-314.pyc
2026-05-17 19:30:28.4967782 E:\GSentinelHealthOS\MB-Chat\scripts\__pycache__\train_model.cpython-314.pyc
2026-05-17 19:30:28.4967782 E:\GSentinelHealthOS\MB-Chat\scripts\__pycache__\train_model_incremental.cpython-314.pyc
2026-05-17 19:30:28.4967782 E:\GSentinelHealthOS\MB-Chat\scripts\__pycache__\validate_onnx_parity.cpython-314.pyc
2026-05-17 19:30:28.4967782 E:\GSentinelHealthOS\MB-Chat\scripts\__pycache__\validate_model.cpython-314.pyc
2026-05-17 19:30:28.5124353 E:\GSentinelHealthOS\MB-Chat\scripts\__pycache__\visualize_features.cpython-314.pyc
2026-05-17 19:30:28.5149425 E:\GSentinelHealthOS\MB-Chat\services\decision_service\app\__pycache__\__init__.cpython-314.pyc
2026-05-17 19:30:28.5149425 E:\GSentinelHealthOS\MB-Chat\services\decision_service\app\__pycache__\dependencies.cpython-314.pyc
2026-05-17 19:30:28.5149425 E:\GSentinelHealthOS\MB-Chat\services\decision_service\__pycache__\__init__.cpython-314.pyc
2026-05-17 19:30:28.5261625 E:\GSentinelHealthOS\MB-Chat\services\decision_service\app\__pycache__\engine.cpython-314.pyc
2026-05-17 19:30:28.5288678 E:\GSentinelHealthOS\MB-Chat\services\decision_service\app\__pycache__\main.cpython-314.pyc
2026-05-17 19:30:28.5308756 E:\GSentinelHealthOS\MB-Chat\services\decision_service\app\__pycache__\routes.cpython-314.pyc
2026-05-17 19:30:28.5328839 E:\GSentinelHealthOS\MB-Chat\services\decision_service\app\__pycache__\rules.cpython-314.pyc
2026-05-17 19:30:28.5364048 E:\GSentinelHealthOS\MB-Chat\services\decision_service\__pycache__\main.cpython-314.pyc
2026-05-17 19:30:28.5364048 E:\GSentinelHealthOS\MB-Chat\services\decision_service\app\__pycache__\schemas.cpython-314.pyc
2026-05-17 19:30:28.5384103 E:\GSentinelHealthOS\MB-Chat\services\dialogue_engine\__pycache__\__init__.cpython-314.pyc
2026-05-17 19:30:28.5404169 E:\GSentinelHealthOS\MB-Chat\services\dialogue_engine\app\__pycache__\__init__.cpython-314.pyc
2026-05-17 19:30:28.5424228 E:\GSentinelHealthOS\MB-Chat\services\dialogue_engine\app\__pycache__\engine.cpython-314.pyc
2026-05-17 19:30:28.5441697 E:\GSentinelHealthOS\MB-Chat\services\dialogue_engine\app\__pycache__\routes.cpython-314.pyc
2026-05-17 19:30:28.5441697 E:\GSentinelHealthOS\MB-Chat\services\dialogue_engine\app\__pycache__\intent_classifier.cpython-314.pyc
2026-05-17 19:30:28.5441697 E:\GSentinelHealthOS\MB-Chat\services\dialogue_engine\app\__pycache__\schemas.cpython-314.pyc
2026-05-17 19:30:28.5441697 E:\GSentinelHealthOS\MB-Chat\services\dialogue_engine\app\__pycache__\main.cpython-314.pyc
2026-05-17 19:30:28.5441697 E:\GSentinelHealthOS\MB-Chat\services\dialogue_engine\app\__pycache__\policies.cpython-314.pyc
2026-05-17 19:30:28.5547072 E:\GSentinelHealthOS\MB-Chat\services\inference_service\__pycache__\__init__.cpython-314.pyc
2026-05-17 19:30:28.5547072 E:\GSentinelHealthOS\MB-Chat\services\dialogue_engine\__pycache__\main.cpython-314.pyc
2026-05-17 19:30:28.5547072 E:\GSentinelHealthOS\MB-Chat\services\dialogue_engine\app\__pycache__\state_manager.cpython-314.pyc
2026-05-17 19:30:28.5598820 E:\GSentinelHealthOS\MB-Chat\services\inference_service\app\__pycache__\__init__.cpython-314.pyc
2026-05-17 19:30:28.5605208 E:\GSentinelHealthOS\MB-Chat\services\inference_service\app\__pycache__\schemas.cpython-314.pyc
2026-05-17 19:30:28.5605208 E:\GSentinelHealthOS\MB-Chat\services\inference_service\app\__pycache__\dependencies.cpython-314.pyc
2026-05-17 19:30:28.5605208 E:\GSentinelHealthOS\MB-Chat\services\inference_service\app\__pycache__\main.cpython-314.pyc
2026-05-17 19:30:28.5605208 E:\GSentinelHealthOS\MB-Chat\services\inference_service\app\__pycache__\routes.cpython-314.pyc
2026-05-17 19:30:28.5605208 E:\GSentinelHealthOS\MB-Chat\services\inference_service\app\__pycache__\service.cpython-314.pyc
2026-05-17 19:30:28.5605208 E:\GSentinelHealthOS\MB-Chat\services\inference_service\__pycache__\main.cpython-314.pyc
2026-05-17 19:30:28.5756410 E:\GSentinelHealthOS\MB-Chat\services\nlg_service\app\__pycache__\__init__.cpython-314.pyc
2026-05-17 19:30:28.5756410 E:\GSentinelHealthOS\MB-Chat\services\nlg_service\app\__pycache__\engine.cpython-314.pyc
2026-05-17 19:30:28.5756410 E:\GSentinelHealthOS\MB-Chat\services\nlg_service\app\__pycache__\generator.cpython-314.pyc
2026-05-17 19:30:28.5756410 E:\GSentinelHealthOS\MB-Chat\services\nlg_service\app\__pycache__\lexicon.cpython-314.pyc
2026-05-17 19:30:28.5756410 E:\GSentinelHealthOS\MB-Chat\services\nlg_service\__pycache__\EXAMPLES.cpython-314.pyc
2026-05-17 19:30:28.5756410 E:\GSentinelHealthOS\MB-Chat\services\nlg_service\__pycache__\__init__.cpython-314.pyc
2026-05-17 19:30:28.5915486 E:\GSentinelHealthOS\MB-Chat\services\nlg_service\app\__pycache__\main.cpython-314.pyc
2026-05-17 19:30:28.5915486 E:\GSentinelHealthOS\MB-Chat\services\nlg_service\app\__pycache__\planner.cpython-314.pyc
2026-05-17 19:30:28.5915486 E:\GSentinelHealthOS\MB-Chat\services\nlg_service\app\__pycache__\reformulator.cpython-314.pyc
2026-05-17 19:30:28.6030212 E:\GSentinelHealthOS\MB-Chat\services\nlg_service\app\__pycache__\routes.cpython-314.pyc
2026-05-17 19:30:28.6030212 E:\GSentinelHealthOS\MB-Chat\services\nlg_service\app\__pycache__\schemas.cpython-314.pyc
2026-05-17 19:30:28.6080341 E:\GSentinelHealthOS\MB-Chat\services\nlg_service\app\__pycache__\templates.cpython-314.pyc
2026-05-17 19:30:28.6080341 E:\GSentinelHealthOS\MB-Chat\services\nlg_service\scripts\__pycache__\smoke_generate_selector.cpython-314.pyc
2026-05-17 19:30:28.6080341 E:\GSentinelHealthOS\MB-Chat\services\nlg_service\__pycache__\main.cpython-314.pyc
2026-05-17 19:30:28.6080341 E:\GSentinelHealthOS\MB-Chat\services\nlg_service\__pycache__\engine.cpython-314.pyc
2026-05-17 19:30:36.6527143 E:\GSentinelHealthOS\MB-Secretaria\node_modules\flatted\python\__pycache__\flatted.cpython-314.pyc
2026-05-17 19:30:38.4966761 E:\GSentinelHealthOS\MB-Whatsapp\cerebro_ai_med\models\__pycache__\train_models.cpython-314.pyc
2026-05-17 19:30:38.5985546 E:\GSentinelHealthOS\MB-Whatsapp\providers_py\openai\__pycache__\adapter.cpython-314.pyc
2026-05-17 19:30:38.5985546 E:\GSentinelHealthOS\MB-Whatsapp\providers_py\local\__pycache__\adapter.cpython-314.pyc
2026-05-17 19:30:38.5985546 E:\GSentinelHealthOS\MB-Whatsapp\providers_py\groq\__pycache__\adapter.cpython-314.pyc
2026-05-17 19:30:38.5985546 E:\GSentinelHealthOS\MB-Whatsapp\providers_py\future_medical\__pycache__\adapter.cpython-314.pyc
2026-05-17 19:30:38.5985546 E:\GSentinelHealthOS\MB-Whatsapp\providers_py\gemini\__pycache__\adapter.cpython-314.pyc
2026-05-17 19:30:38.6359007 E:\GSentinelHealthOS\MB-Whatsapp\scripts\__pycache__\analyze_features.cpython-314.pyc
2026-05-17 19:30:38.6465433 E:\GSentinelHealthOS\MB-Whatsapp\scripts\__pycache__\demo_model_registry.cpython-314.pyc
2026-05-17 19:30:38.6465433 E:\GSentinelHealthOS\MB-Whatsapp\scripts\__pycache__\data_pipeline.cpython-314.pyc
2026-05-17 19:30:38.6618467 E:\GSentinelHealthOS\MB-Whatsapp\scripts\__pycache__\model_monitor.cpython-314.pyc
2026-05-17 19:30:38.6618467 E:\GSentinelHealthOS\MB-Whatsapp\scripts\__pycache__\model_compare.cpython-314.pyc
2026-05-17 19:30:38.6618467 E:\GSentinelHealthOS\MB-Whatsapp\scripts\__pycache__\feature_selection.cpython-314.pyc
2026-05-17 19:30:38.6778417 E:\GSentinelHealthOS\MB-Whatsapp\scripts\__pycache__\model_registry.cpython-314.pyc
2026-05-17 19:30:38.6778417 E:\GSentinelHealthOS\MB-Whatsapp\scripts\__pycache__\model_rollback.cpython-314.pyc
2026-05-17 19:30:38.6778417 E:\GSentinelHealthOS\MB-Whatsapp\scripts\__pycache__\run_ml_validation.cpython-314.pyc
2026-05-17 19:30:38.7095592 E:\GSentinelHealthOS\MB-Whatsapp\scripts\__pycache__\train_model_incremental.cpython-314.pyc
2026-05-17 19:30:38.7095592 E:\GSentinelHealthOS\MB-Whatsapp\scripts\__pycache__\train_model.cpython-314.pyc
2026-05-17 19:30:38.7253102 E:\GSentinelHealthOS\MB-Whatsapp\scripts\__pycache__\validate_model.cpython-314.pyc
2026-05-17 19:30:38.7253102 E:\GSentinelHealthOS\MB-Whatsapp\scripts\__pycache__\visualize_features.cpython-314.pyc
2026-05-17 19:30:38.7650579 E:\GSentinelHealthOS\MB-Whatsapp\services\nlg_service\__pycache__\EXAMPLES.cpython-314.pyc
2026-05-17 19:30:38.7733088 E:\GSentinelHealthOS\MB-Whatsapp\services\nlg_service\app\__pycache__\engine.cpython-314.pyc
2026-05-17 19:30:38.7780380 E:\GSentinelHealthOS\MB-Whatsapp\services\nlg_service\app\__pycache__\generator.cpython-314.pyc
2026-05-17 19:30:38.7817283 E:\GSentinelHealthOS\MB-Whatsapp\services\nlg_service\app\__pycache__\lexicon.cpython-314.pyc
2026-05-17 19:30:38.7832808 E:\GSentinelHealthOS\MB-Whatsapp\services\nlg_service\app\__pycache__\main.cpython-314.pyc
2026-05-17 19:30:38.7901777 E:\GSentinelHealthOS\MB-Whatsapp\services\nlg_service\app\__pycache__\planner.cpython-314.pyc
2026-05-17 19:30:39.4066938 E:\GSentinelHealthOS\MB-Whatsapp\services\nlg_service\app\__pycache__\routes.cpython-314.pyc
2026-05-17 19:30:39.4072085 E:\GSentinelHealthOS\MB-Whatsapp\services\nlg_service\app\__pycache__\schemas.cpython-314.pyc
2026-05-18 01:04:46.9418045 E:\GSentinelHealthOS\MB-Chat\data\medical-chat-learning.jsonl
```
