# RUNTIME ISOLATION PRECHECK
Generated: 2026-05-19 00:10:48 -03:00
Root: E:\GSentinelHealthOS
Rules: audit-only, no mutation
## Running containers
```
NAMES                           IMAGE                                 COMMAND                  STATUS                 PORTS
gsentinel_redis_precanary_lab   redis:8.0.2-alpine                    "docker-entrypoint.s…"   Up 2 hours (healthy)   127.0.0.1:56380->6379/tcp
gs_frontend                     gsentinelhealthos-frontend            "docker-entrypoint.s…"   Up 5 hours (healthy)   3000/tcp
gs_brain                        gsentinelhealthos-brain               "python brain/main.py"   Up 5 hours (healthy)   8001/tcp
gs_api                          gsentinelhealthos-api                 "uvicorn api.app.mai…"   Up 5 hours (healthy)   127.0.0.1:8000->8000/tcp
gs_redis_sentinel_1             redis:8.0.2-alpine                    "docker-entrypoint.s…"   Up 5 hours (healthy)   6379/tcp
gs_redis_replica                redis:8.0.2-alpine                    "docker-entrypoint.s…"   Up 5 hours (healthy)   6379/tcp
gs_db                           postgres:16-alpine                    "docker-entrypoint.s…"   Up 5 hours (healthy)   127.0.0.1:55433->5432/tcp
gs_redis_master                 redis:8.0.2-alpine                    "docker-entrypoint.s…"   Up 5 hours (healthy)   6379/tcp
gs_panel_admin                  gsentinelhealthos-panel-admin         "docker-entrypoint.s…"   Up 5 hours (healthy)   3010/tcp
gs_grafana                      grafana/grafana:10.4.2                "/run.sh"                Up 5 hours (healthy)   3000/tcp
gs_promtail                     grafana/promtail:2.9.8                "/usr/bin/promtail -…"   Up 5 hours             
gs_outbox_scheduler             gsentinelhealthos-outbox_scheduler    "python scripts/run_…"   Up 5 hours (healthy)   
gs_gateway                      gsentinelhealthos-gateway             "uvicorn whatsapp_ga…"   Up 5 hours (healthy)   8002/tcp
gs_loki                         grafana/loki:2.9.8                    "/usr/bin/loki -conf…"   Up 5 hours (healthy)   3100/tcp
gs_nlg_service                  gsentinelhealthos-nlg-service         "uvicorn services.nl…"   Up 5 hours (healthy)   8013/tcp
gs_prometheus                   prom/prometheus:v2.51.0               "/bin/prometheus --c…"   Up 5 hours (healthy)   9090/tcp
gs_dialogue_engine              gsentinelhealthos-dialogue-engine     "uvicorn services.di…"   Up 5 hours (healthy)   8010/tcp
gs_booking_worker_1             gsentinelhealthos-booking_worker_1    "python -m api.app.b…"   Up 5 hours (healthy)   
gs_inference_service            gsentinelhealthos-inference-service   "uvicorn services.in…"   Up 5 hours (healthy)   8011/tcp
gs_decision_service             gsentinelhealthos-decision-service    "uvicorn services.de…"   Up 5 hours (healthy)   8012/tcp
gs_booking_worker_0             gsentinelhealthos-booking_worker_0    "python -m api.app.b…"   Up 5 hours (healthy)   
gs_redis_sentinel_2             redis:8.0.2-alpine                    "docker-entrypoint.s…"   Up 5 hours (healthy)   6379/tcp
gs_redis_sentinel_3             redis:8.0.2-alpine                    "docker-entrypoint.s…"   Up 5 hours (healthy)   6379/tcp

```
## docker inspect $(docker ps -q) raw
```
[
    {
        "Id": "36e327879899958c7468d60b1d454fbbdb95d83ed8c133186f444cd33e493e9c",
        "Created": "2026-05-19T01:29:03.468283011Z",
        "Path": "docker-entrypoint.sh",
        "Args": [
            "redis-server",
            "--save",
            "",
            "--appendonly",
            "no"
        ],
        "State": {
            "Status": "running",
            "Running": true,
            "Paused": false,
            "Restarting": false,
            "OOMKilled": false,
            "Dead": false,
            "Pid": 315249,
            "ExitCode": 0,
            "Error": "",
            "StartedAt": "2026-05-19T01:29:04.662172426Z",
            "FinishedAt": "0001-01-01T00:00:00Z",
            "Health": {
                "Status": "healthy",
                "FailingStreak": 0,
                "Log": [
                    {
                        "Start": "2026-05-19T03:10:28.858720688Z",
                        "End": "2026-05-19T03:10:28.918371808Z",
                        "ExitCode": 0,
                        "Output": "PONG\n"
                    },
                    {
                        "Start": "2026-05-19T03:10:33.919494804Z",
                        "End": "2026-05-19T03:10:33.989340991Z",
                        "ExitCode": 0,
                        "Output": "PONG\n"
                    },
                    {
                        "Start": "2026-05-19T03:10:38.990471244Z",
                        "End": "2026-05-19T03:10:39.053654442Z",
                        "ExitCode": 0,
                        "Output": "PONG\n"
                    },
                    {
                        "Start": "2026-05-19T03:10:44.055065558Z",
                        "End": "2026-05-19T03:10:44.139066021Z",
                        "ExitCode": 0,
                        "Output": "PONG\n"
                    },
                    {
                        "Start": "2026-05-19T03:10:49.139605952Z",
                        "End": "2026-05-19T03:10:49.204818843Z",
                        "ExitCode": 0,
                        "Output": "PONG\n"
                    }
                ]
            }
        },
        "Image": "sha256:e74faa347ab0b6a3c1b040834a35ea5f20e3aa02460db4bb9d5b4685f3dd3baf",
        "ResolvConfPath": "/var/lib/docker/containers/36e327879899958c7468d60b1d454fbbdb95d83ed8c133186f444cd33e493e9c/resolv.conf",
        "HostnamePath": "/var/lib/docker/containers/36e327879899958c7468d60b1d454fbbdb95d83ed8c133186f444cd33e493e9c/hostname",
        "HostsPath": "/var/lib/docker/containers/36e327879899958c7468d60b1d454fbbdb95d83ed8c133186f444cd33e493e9c/hosts",
        "LogPath": "/var/lib/docker/containers/36e327879899958c7468d60b1d454fbbdb95d83ed8c133186f444cd33e493e9c/36e327879899958c7468d60b1d454fbbdb95d83ed8c133186f444cd33e493e9c-json.log",
        "Name": "/gsentinel_redis_precanary_lab",
        "RestartCount": 0,
        "Driver": "overlay2",
        "Platform": "linux",
        "MountLabel": "",
        "ProcessLabel": "",
        "AppArmorProfile": "",
        "ExecIDs": null,
        "HostConfig": {
            "Binds": null,
            "ContainerIDFile": "",
            "LogConfig": {
                "Type": "json-file",
                "Config": {}
            },
            "NetworkMode": "gsentinel_precanary_lab_net",
            "PortBindings": {
                "6379/tcp": [
                    {
                        "HostIp": "127.0.0.1",
                        "HostPort": "56380"
                    }
                ]
            },
            "RestartPolicy": {
                "Name": "no",
                "MaximumRetryCount": 0
            },
            "AutoRemove": false,
            "VolumeDriver": "",
            "VolumesFrom": null,
            "ConsoleSize": [
                0,
                0
            ],
            "CapAdd": null,
            "CapDrop": null,
            "CgroupnsMode": "private",
            "Dns": null,
            "DnsOptions": null,
            "DnsSearch": null,
            "ExtraHosts": [],
            "GroupAdd": null,
            "IpcMode": "private",
            "Cgroup": "",
            "Links": null,
            "OomScoreAdj": 0,
            "PidMode": "",
            "Privileged": false,
            "PublishAllPorts": false,
            "ReadonlyRootfs": false,
            "SecurityOpt": null,
            "UTSMode": "",
            "UsernsMode": "",
            "ShmSize": 67108864,
            "Runtime": "runc",
            "Isolation": "",
            "CpuShares": 0,
            "Memory": 0,
            "NanoCpus": 0,
            "CgroupParent": "",
            "BlkioWeight": 0,
            "BlkioWeightDevice": null,
            "BlkioDeviceReadBps": null,
            "BlkioDeviceWriteBps": null,
            "BlkioDeviceReadIOps": null,
            "BlkioDeviceWriteIOps": null,
            "CpuPeriod": 0,
            "CpuQuota": 0,
            "CpuRealtimePeriod": 0,
            "CpuRealtimeRuntime": 0,
            "CpusetCpus": "",
            "CpusetMems": "",
            "Devices": null,
            "DeviceCgroupRules": null,
            "DeviceRequests": null,
            "MemoryReservation": 0,
            "MemorySwap": 0,
            "MemorySwappiness": null,
            "OomKillDisable": null,
            "PidsLimit": null,
            "Ulimits": null,
            "CpuCount": 0,
            "CpuPercent": 0,
            "IOMaximumIOps": 0,
            "IOMaximumBandwidth": 0,
            "MaskedPaths": [
                "/proc/acpi",
                "/proc/asound",
                "/proc/interrupts",
                "/proc/kcore",
                "/proc/keys",
                "/proc/latency_stats",
                "/proc/sched_debug",
                "/proc/scsi",
                "/proc/timer_list",
                "/proc/timer_stats",
                "/sys/devices/virtual/powercap",
                "/sys/firmware"
            ],
            "ReadonlyPaths": [
                "/proc/bus",
                "/proc/fs",
                "/proc/irq",
                "/proc/sys",
                "/proc/sysrq-trigger"
            ]
        },
        "GraphDriver": {
            "Data": {
                "ID": "36e327879899958c7468d60b1d454fbbdb95d83ed8c133186f444cd33e493e9c",
                "LowerDir": "/var/lib/docker/overlay2/c033bf0b710f63081a43bb7178f553e2790f77f88051d5e4715f6dbba323e5b5-init/diff:/var/lib/docker/overlay2/8c9090380150b4636f6319b5c2b8adc07efaca5df68e948e6418fd36c142f49d/diff:/var/lib/docker/overlay2/e85f396d82ffc5d990826d062fe059185779692ff70111fe596efb62c2876923/diff:/var/lib/docker/overlay2/8cca02262c9f2436236c122d7e63eba78ab4be5b77971c372934efcb7bf5bdf1/diff:/var/lib/docker/overlay2/7267c3d380a80502ea27c1cf22254c597730fa6f0bf94e8b9fcb6dd189c771a1/diff:/var/lib/docker/overlay2/6de7058bf8829c0201fb6b07e6f1b2b08c8be1068e686abc36ee6a8175fd320f/diff:/var/lib/docker/overlay2/4f0da3802045cf986cc9b74d1eeb229e70ab60670cef9f9fbd9b6a77ae4c0ea2/diff:/var/lib/docker/overlay2/fccffb1cd9ddd708bbb163c23a68583fc17fda15258ccaf798f28f97bbe2319d/diff",
                "MergedDir": "/var/lib/docker/overlay2/c033bf0b710f63081a43bb7178f553e2790f77f88051d5e4715f6dbba323e5b5/merged",
                "UpperDir": "/var/lib/docker/overlay2/c033bf0b710f63081a43bb7178f553e2790f77f88051d5e4715f6dbba323e5b5/diff",
                "WorkDir": "/var/lib/docker/overlay2/c033bf0b710f63081a43bb7178f553e2790f77f88051d5e4715f6dbba323e5b5/work"
            },
            "Name": "overlay2"
        },
        "Mounts": [
            {
                "Type": "volume",
                "Name": "cf209b9004adcb0b0d94cf6432af022b3953c52f5d0d1ed6d4186b9df8679696",
                "Source": "/var/lib/docker/volumes/cf209b9004adcb0b0d94cf6432af022b3953c52f5d0d1ed6d4186b9df8679696/_data",
                "Destination": "/data",
                "Driver": "local",
                "Mode": "",
                "RW": true,
                "Propagation": ""
            }
        ],
        "Config": {
            "Hostname": "36e327879899",
            "Domainname": "",
            "User": "",
            "AttachStdin": false,
            "AttachStdout": true,
            "AttachStderr": true,
            "ExposedPorts": {
                "6379/tcp": {}
            },
            "Tty": false,
            "OpenStdin": false,
            "StdinOnce": false,
            "Env": [
                "PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
                "REDIS_DOWNLOAD_URL=https://github.com/redis/redis/archive/refs/tags/8.0.2.tar.gz",
                "REDIS_DOWNLOAD_SHA=caf3c0069f06fc84c5153bd2a348b204c578de80490c73857bee01d9b5d7401f"
            ],
            "Cmd": [
                "redis-server",
                "--save",
                "",
                "--appendonly",
                "no"
            ],
            "Healthcheck": {
                "Test": [
                    "CMD",
                    "redis-cli",
                    "-h",
                    "127.0.0.1",
                    "-p",
                    "6379",
                    "ping"
                ],
                "Interval": 5000000000,
                "Timeout": 3000000000,
                "Retries": 20
            },
            "Image": "redis:8.0.2-alpine",
            "Volumes": {
                "/data": {}
            },
            "WorkingDir": "/data",
            "Entrypoint": [
                "docker-entrypoint.sh"
            ],
            "Labels": {
                "com.docker.compose.config-hash": "1e1308635ecc99078e770aab95ccc846383b7e350f09b9fe8bed478cf519402d",
                "com.docker.compose.container-number": "1",
                "com.docker.compose.depends_on": "",
                "com.docker.compose.image": "sha256:e74faa347ab0b6a3c1b040834a35ea5f20e3aa02460db4bb9d5b4685f3dd3baf",
                "com.docker.compose.oneoff": "False",
                "com.docker.compose.project": "gsentinelhealthos",
                "com.docker.compose.project.config_files": "E:\\GSentinelHealthOS\\docker-compose.precanary-lab.yml",
                "com.docker.compose.project.working_dir": "E:\\GSentinelHealthOS",
                "com.docker.compose.service": "redis_precanary_lab",
                "com.docker.compose.version": "5.1.0"
            },
            "StopTimeout": 1
        },
        "NetworkSettings": {
            "SandboxID": "db3aa831bba617543c617639124b3cc074b0505f7c4758d295cd149f646402e4",
            "SandboxKey": "/var/run/docker/netns/db3aa831bba6",
            "Ports": {
                "6379/tcp": [
                    {
                        "HostIp": "127.0.0.1",
                        "HostPort": "56380"
                    }
                ]
            },
            "Networks": {
                "gsentinel_precanary_lab_net": {
                    "IPAMConfig": null,
                    "Links": null,
                    "Aliases": [
                        "gsentinel_redis_precanary_lab",
                        "redis_precanary_lab"
                    ],
                    "DriverOpts": null,
                    "GwPriority": 0,
                    "NetworkID": "2826f64c42e203e7870bd12aa00148c8e1e2c8e0f9c402f9f249dcb4acef71dd",
                    "EndpointID": "6e764fdf62cb985d101176fab3fe5ad1d13ce7e74a110c3dd0b00fc826c06d8a",
                    "Gateway": "172.21.0.1",
                    "IPAddress": "172.21.0.2",
                    "MacAddress": "06:a6:a4:27:85:64",
                    "IPPrefixLen": 16,
                    "IPv6Gateway": "",
                    "GlobalIPv6Address": "",
                    "GlobalIPv6PrefixLen": 0,
                    "DNSNames": [
                        "gsentinel_redis_precanary_lab",
                        "redis_precanary_lab",
                        "36e327879899"
                    ]
                }
            }
        }
    },
    {
        "Id": "fcdc34faf07b917c1ed319fbfe741b4b92ced7ceef69385f72420fb53c5f974e",
        "Created": "2026-05-17T22:15:00.997758629Z",
        "Path": "docker-entrypoint.sh",
        "Args": [
            "node",
            "server.js"
        ],
        "State": {
            "Status": "running",
            "Running": true,
            "Paused": false,
            "Restarting": false,
            "OOMKilled": false,
            "Dead": false,
            "Pid": 1190,
            "ExitCode": 0,
            "Error": "",
            "StartedAt": "2026-05-18T21:45:20.067295015Z",
            "FinishedAt": "2026-05-18T21:45:16.195256038Z",
            "Health": {
                "Status": "healthy",
                "FailingStreak": 0,
                "Log": [
                    {
                        "Start": "2026-05-19T03:08:33.408089413Z",
                        "End": "2026-05-19T03:08:33.736997847Z",
                        "ExitCode": 0,
                        "Output": ""
                    },
                    {
                        "Start": "2026-05-19T03:09:03.647797059Z",
                        "End": "2026-05-19T03:09:03.912539849Z",
                        "ExitCode": 0,
                        "Output": ""
                    },
                    {
                        "Start": "2026-05-19T03:09:33.792113312Z",
                        "End": "2026-05-19T03:09:34.112845082Z",
                        "ExitCode": 0,
                        "Output": ""
                    },
                    {
                        "Start": "2026-05-19T03:10:04.029140936Z",
                        "End": "2026-05-19T03:10:04.276997356Z",
                        "ExitCode": 0,
                        "Output": ""
                    },
                    {
                        "Start": "2026-05-19T03:10:34.195965717Z",
                        "End": "2026-05-19T03:10:34.564786242Z",
                        "ExitCode": 0,
                        "Output": ""
                    }
                ]
            }
        },
        "Image": "sha256:eab7165d7d391ab76449d0650ca597938f86bd4ebd2041aaadb7027a7b260b28",
        "ResolvConfPath": "/var/lib/docker/containers/fcdc34faf07b917c1ed319fbfe741b4b92ced7ceef69385f72420fb53c5f974e/resolv.conf",
        "HostnamePath": "/var/lib/docker/containers/fcdc34faf07b917c1ed319fbfe741b4b92ced7ceef69385f72420fb53c5f974e/hostname",
        "HostsPath": "/var/lib/docker/containers/fcdc34faf07b917c1ed319fbfe741b4b92ced7ceef69385f72420fb53c5f974e/hosts",
        "LogPath": "/var/lib/docker/containers/fcdc34faf07b917c1ed319fbfe741b4b92ced7ceef69385f72420fb53c5f974e/fcdc34faf07b917c1ed319fbfe741b4b92ced7ceef69385f72420fb53c5f974e-json.log",
        "Name": "/gs_frontend",
        "RestartCount": 0,
        "Driver": "overlay2",
        "Platform": "linux",
        "MountLabel": "",
        "ProcessLabel": "",
        "AppArmorProfile": "",
        "ExecIDs": null,
        "HostConfig": {
            "Binds": [
                "E:\\GSentinelHealthOS\\MB-Chat\\data:/app/artifacts/mb-chat-learning:rw"
            ],
            "ContainerIDFile": "",
            "LogConfig": {
                "Type": "json-file",
                "Config": {
                    "max-file": "3",
                    "max-size": "10m"
                }
            },
            "NetworkMode": "gsentinelhealthos_gs_prod",
            "PortBindings": {
                "3000/tcp": [
                    {
                        "HostIp": "127.0.0.1",
                        "HostPort": "3000"
                    }
                ]
            },
            "RestartPolicy": {
                "Name": "unless-stopped",
                "MaximumRetryCount": 0
            },
            "AutoRemove": false,
            "VolumeDriver": "",
            "VolumesFrom": null,
            "ConsoleSize": [
                0,
                0
            ],
            "CapAdd": null,
            "CapDrop": null,
            "CgroupnsMode": "private",
            "Dns": [],
            "DnsOptions": [],
            "DnsSearch": [],
            "ExtraHosts": [],
            "GroupAdd": null,
            "IpcMode": "private",
            "Cgroup": "",
            "Links": null,
            "OomScoreAdj": 0,
            "PidMode": "",
            "Privileged": false,
            "PublishAllPorts": false,
            "ReadonlyRootfs": false,
            "SecurityOpt": [
                "no-new-privileges:true"
            ],
            "UTSMode": "",
            "UsernsMode": "",
            "ShmSize": 67108864,
            "Runtime": "runc",
            "Isolation": "",
            "CpuShares": 0,
            "Memory": 536870912,
            "NanoCpus": 1000000000,
            "CgroupParent": "",
            "BlkioWeight": 0,
            "BlkioWeightDevice": null,
            "BlkioDeviceReadBps": null,
            "BlkioDeviceWriteBps": null,
            "BlkioDeviceReadIOps": null,
            "BlkioDeviceWriteIOps": null,
            "CpuPeriod": 0,
            "CpuQuota": 0,
            "CpuRealtimePeriod": 0,
            "CpuRealtimeRuntime": 0,
            "CpusetCpus": "",
            "CpusetMems": "",
            "Devices": null,
            "DeviceCgroupRules": null,
            "DeviceRequests": null,
            "MemoryReservation": 0,
            "MemorySwap": 1073741824,
            "MemorySwappiness": null,
            "OomKillDisable": null,
            "PidsLimit": null,
            "Ulimits": null,
            "CpuCount": 0,
            "CpuPercent": 0,
            "IOMaximumIOps": 0,
            "IOMaximumBandwidth": 0,
            "MaskedPaths": [
                "/proc/acpi",
                "/proc/asound",
                "/proc/interrupts",
                "/proc/kcore",
                "/proc/keys",
                "/proc/latency_stats",
                "/proc/sched_debug",
                "/proc/scsi",
                "/proc/timer_list",
                "/proc/timer_stats",
                "/sys/devices/virtual/powercap",
                "/sys/firmware"
            ],
            "ReadonlyPaths": [
                "/proc/bus",
                "/proc/fs",
                "/proc/irq",
                "/proc/sys",
                "/proc/sysrq-trigger"
            ]
        },
        "GraphDriver": {
            "Data": {
                "ID": "fcdc34faf07b917c1ed319fbfe741b4b92ced7ceef69385f72420fb53c5f974e",
                "LowerDir": "/var/lib/docker/overlay2/0ffc37b29ebea235ee905f3cf5b676ff527cadbec5b2592599860997974dd58b-init/diff:/var/lib/docker/overlay2/85xtwo7ew2agmzyllx2jd4h5x/diff:/var/lib/docker/overlay2/nyzcppzkmbxtbpc854cwwownl/diff:/var/lib/docker/overlay2/33yxrw1qj02rj00pwvdff92oi/diff:/var/lib/docker/overlay2/febw56hfgm6iyv6tcq4y279bv/diff:/var/lib/docker/overlay2/u7t4zw5xz4rtsmwq3b5di48vo/diff:/var/lib/docker/overlay2/3rq1ubtorbbq2gvborwc8wc6h/diff:/var/lib/docker/overlay2/z485d9qhv094enxa4gwu4kyqj/diff:/var/lib/docker/overlay2/q83fot929mhpvfidp4tnjouaa/diff:/var/lib/docker/overlay2/fd40b3993207e5be24e64c59adc2987319adaa19150216d15eb0f5c7bb82acbc/diff:/var/lib/docker/overlay2/687bc25c21e5a5f1a6182cbf365a64c22db3b8160b12eebf13e53f9a06e98925/diff:/var/lib/docker/overlay2/dd08012ba56223cfa4434c5c0f6ebb2b22f6158f43ffb78cfeb7f287339fff67/diff:/var/lib/docker/overlay2/8ab13d1f48d85546e93f3bf50e5c7b2d12fe1d2fb9d425d9b6a42026c024caf2/diff:/var/lib/docker/overlay2/fc3eb5d0226ef1f2f74a806f24f083335fb4ab0818c0aa203c92e4de212ec0bf/diff",
                "MergedDir": "/var/lib/docker/overlay2/0ffc37b29ebea235ee905f3cf5b676ff527cadbec5b2592599860997974dd58b/merged",
                "UpperDir": "/var/lib/docker/overlay2/0ffc37b29ebea235ee905f3cf5b676ff527cadbec5b2592599860997974dd58b/diff",
                "WorkDir": "/var/lib/docker/overlay2/0ffc37b29ebea235ee905f3cf5b676ff527cadbec5b2592599860997974dd58b/work"
            },
            "Name": "overlay2"
        },
        "Mounts": [
            {
                "Type": "bind",
                "Source": "E:\\GSentinelHealthOS\\MB-Chat\\data",
                "Destination": "/app/artifacts/mb-chat-learning",
                "Mode": "rw",
                "RW": true,
                "Propagation": "rprivate"
            }
        ],
        "Config": {
            "Hostname": "fcdc34faf07b",
            "Domainname": "",
            "User": "nextjs",
            "AttachStdin": false,
            "AttachStdout": true,
            "AttachStderr": true,
            "ExposedPorts": {
                "3000/tcp": {}
            },
            "Tty": false,
            "OpenStdin": false,
            "StdinOnce": false,
            "Env": [
                "MEDICAL_RUNTIME_CONTEXT_TIMEZONE=America/Argentina/Buenos_Aires",
                "MEDICAL_RUNTIME_CONTEXT_WEATHER_ENABLED=true",
                "DOCUMENT_AI_BASE_URL=https://api.groq.com/openai/v1",
                "BRAIN_API_KEY=INTERNAL_KEY_REDACTED",
                "DOCUMENT_AI_PROVIDER=groq",
                "MEDICAL_CHAT_LEARNING_PATH=/app/artifacts/mb-chat-learning/medical-chat-learning.jsonl",
                "DOCUMENT_AI_API_KEY=GROQ_KEY_REDACTED",
                "GROQ_API_KEY_SECRETARIA=GROQ_KEY_REDACTED",
                "MEDICAL_RUNTIME_CONTEXT_LATITUDE=",
                "REDIS_URL=redis://:bDAhxY9Af2LcR86iXN7U9gBIDpGeVuaiiKPLBTvEqLP2vbvy@redis-master:6379",
                "MEDICAL_RUNTIME_CONTEXT_LONGITUDE=",
                "JWT_EXPIRES_IN_HOURS=24",
                "WHATSAPP_AUTO_BOOT_WORKERS=false",
                "BRAIN_API_URL=http://brain:8001",
                "NEXT_TELEMETRY_DISABLED=1",
                "GROQ_MODEL_CHAT=meta-llama/llama-4-scout-17b-16e-instruct",
                "GROQ_API_KEY=GROQ_KEY_REDACTED",
                "MEDICAL_RUNTIME_CONTEXT_ALERTS_ENABLED=false",
                "MEDICAL_WEB_RETRIEVAL_ENABLED=true",
                "NODE_ENV=production",
                "ENCRYPTION_KEY=Rd0JhO5AyXmMD89fPSNt6zjKxiF1cbo2",
                "MEDICAL_RUNTIME_CONTEXT_CACHE_TTL_SECONDS=900",
                "DOCUMENT_AI_ENABLED=false",
                "DATABASE_URL=postgresql://sentinel:OzMTDZYpxmFNivfGStWo0kB6Xb85Uweh@db:5432/gsentinel_saas",
                "MEDICAL_RUNTIME_CONTEXT_TIMEOUT_MS=5000",
                "MEDICAL_CHAT_INTERNET_MODE=open",
                "GROQ_API_KEY_CHAT=GROQ_KEY_REDACTED",
                "ENV=production",
                "BRAIN_TIMEOUT_MS=5000",
                "MEDICAL_RUNTIME_CONTEXT_REGION=",
                "GROQ_MODEL_SECRETARIA=meta-llama/llama-4-scout-17b-16e-instruct",
                "MEDICAL_RUNTIME_CONTEXT_ENABLED=true",
                "JWT_SECRET=fGd8p7xXW3FtuPco5zM4QOsHlmwgNKiJ9TrvYCEnab2Z1LqS",
                "GROQ_MODEL=llama-3.3-70b-versatile",
                "GROQ_BASE_URL=https://api.groq.com/openai/v1",
                "GROQ_IMAGE_ANALYSIS_API_KEY=GROQ_KEY_REDACTED",
                "PANEL_ADMIN_API_KEY=PANEL_ADMIN_KEY_REDACTED",
                "WHATSAPP_API_VERSION=v25.0",
                "PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
                "NODE_VERSION=20.20.2",
                "YARN_VERSION=1.22.22",
                "PORT=3000",
                "HOSTNAME=0.0.0.0"
            ],
            "Cmd": [
                "node",
                "server.js"
            ],
            "Healthcheck": {
                "Test": [
                    "CMD-SHELL",
                    "node -e \"fetch('http://localhost:3000/').then(r=\u003eprocess.exit(r.ok?0:1)).catch(()=\u003eprocess.exit(1))\""
                ],
                "Interval": 30000000000,
                "Timeout": 10000000000,
                "Retries": 3
            },
            "Image": "gsentinelhealthos-frontend",
            "Volumes": null,
            "WorkingDir": "/app",
            "Entrypoint": [
                "docker-entrypoint.sh"
            ],
            "Labels": {
                "com.docker.compose.config-hash": "2e6cdc5d380ce748b8e5f5134bdc9337021af6869ee55be6a301185f2a8b7a1e",
                "com.docker.compose.container-number": "1",
                "com.docker.compose.depends_on": "",
                "com.docker.compose.image": "sha256:eab7165d7d391ab76449d0650ca597938f86bd4ebd2041aaadb7027a7b260b28",
                "com.docker.compose.oneoff": "False",
                "com.docker.compose.project": "gsentinelhealthos",
                "com.docker.compose.project.config_files": "E:\\GSentinelHealthOS\\docker-compose.yml",
                "com.docker.compose.project.working_dir": "E:\\GSentinelHealthOS",
                "com.docker.compose.replace": "gs_frontend",
                "com.docker.compose.service": "frontend",
                "com.docker.compose.version": "5.1.0"
            },
            "StopTimeout": 1
        },
        "NetworkSettings": {
            "SandboxID": "de918cb5fc183d4b18684f69d7d86f124b8a9ca0415fd1afa93fe4c14a14738c",
            "SandboxKey": "/var/run/docker/netns/de918cb5fc18",
            "Ports": {
                "3000/tcp": []
            },
            "Networks": {
                "gsentinelhealthos_gs_prod": {
                    "IPAMConfig": null,
                    "Links": null,
                    "Aliases": [
                        "gs_frontend",
                        "frontend"
                    ],
                    "DriverOpts": null,
                    "GwPriority": 0,
                    "NetworkID": "919bd5f232a0b0588e6ca20e3c563d7ca6731d36e1524f9f82fd1a1f698a1813",
                    "EndpointID": "cf536e6309fd430f08584d4789eb1531dab129f28ac7455865bb91415873c8a8",
                    "Gateway": "172.20.0.1",
                    "IPAddress": "172.20.0.16",
                    "MacAddress": "e6:dd:1d:f8:40:ad",
                    "IPPrefixLen": 16,
                    "IPv6Gateway": "",
                    "GlobalIPv6Address": "",
                    "GlobalIPv6PrefixLen": 0,
                    "DNSNames": [
                        "gs_frontend",
                        "frontend",
                        "fcdc34faf07b"
                    ]
                }
            }
        }
    },
    {
        "Id": "50e2816bfd19977d0c51ef8446c5759e083616393e49c07b1c52c19e63b3470b",
        "Created": "2026-05-17T20:51:01.615571323Z",
        "Path": "python",
        "Args": [
            "brain/main.py"
        ],
        "State": {
            "Status": "running",
            "Running": true,
            "Paused": false,
            "Restarting": false,
            "OOMKilled": false,
            "Dead": false,
            "Pid": 1098,
            "ExitCode": 0,
            "Error": "",
            "StartedAt": "2026-05-18T21:45:20.017251044Z",
            "FinishedAt": "2026-05-18T21:45:16.19452457Z",
            "Health": {
                "Status": "healthy",
                "FailingStreak": 0,
                "Log": [
                    {
                        "Start": "2026-05-19T03:08:32.429068954Z",
                        "End": "2026-05-19T03:08:32.533328422Z",
                        "ExitCode": 0,
                        "Output": ""
                    },
                    {
                        "Start": "2026-05-19T03:09:02.44446361Z",
                        "End": "2026-05-19T03:09:02.571991654Z",
                        "ExitCode": 0,
                        "Output": ""
                    },
                    {
                        "Start": "2026-05-19T03:09:32.451046079Z",
                        "End": "2026-05-19T03:09:32.565781656Z",
                        "ExitCode": 0,
                        "Output": ""
                    },
                    {
                        "Start": "2026-05-19T03:10:02.481882828Z",
                        "End": "2026-05-19T03:10:02.618530834Z",
                        "ExitCode": 0,
                        "Output": ""
                    },
                    {
                        "Start": "2026-05-19T03:10:32.537733299Z",
                        "End": "2026-05-19T03:10:32.648556233Z",
                        "ExitCode": 0,
                        "Output": ""
                    }
                ]
            }
        },
        "Image": "sha256:659ad05b1ff409a28ef2ef301f49e96c797290cd890e347cde2325be895781d7",
        "ResolvConfPath": "/var/lib/docker/containers/50e2816bfd19977d0c51ef8446c5759e083616393e49c07b1c52c19e63b3470b/resolv.conf",
        "HostnamePath": "/var/lib/docker/containers/50e2816bfd19977d0c51ef8446c5759e083616393e49c07b1c52c19e63b3470b/hostname",
        "HostsPath": "/var/lib/docker/containers/50e2816bfd19977d0c51ef8446c5759e083616393e49c07b1c52c19e63b3470b/hosts",
        "LogPath": "/var/lib/docker/containers/50e2816bfd19977d0c51ef8446c5759e083616393e49c07b1c52c19e63b3470b/50e2816bfd19977d0c51ef8446c5759e083616393e49c07b1c52c19e63b3470b-json.log",
        "Name": "/gs_brain",
        "RestartCount": 0,
        "Driver": "overlay2",
        "Platform": "linux",
        "MountLabel": "",
        "ProcessLabel": "",
        "AppArmorProfile": "",
        "ExecIDs": null,
        "HostConfig": {
            "Binds": [
                "gsentinelhealthos_uploads_data:/data/uploads:rw",
                "/run/desktop/mnt/host/e/GSentinelHealthOS/MB-Chat/data:/app/artifacts/mb-chat-learning:rw"
            ],
            "ContainerIDFile": "",
            "LogConfig": {
                "Type": "json-file",
                "Config": {
                    "max-file": "3",
                    "max-size": "10m"
                }
            },
            "NetworkMode": "gsentinelhealthos_gs_prod",
            "PortBindings": {
                "8001/tcp": [
                    {
                        "HostIp": "127.0.0.1",
                        "HostPort": "8001"
                    }
                ]
            },
            "RestartPolicy": {
                "Name": "unless-stopped",
                "MaximumRetryCount": 0
            },
            "AutoRemove": false,
            "VolumeDriver": "",
            "VolumesFrom": null,
            "ConsoleSize": [
                0,
                0
            ],
            "CapAdd": null,
            "CapDrop": null,
            "CgroupnsMode": "private",
            "Dns": [],
            "DnsOptions": [],
            "DnsSearch": [],
            "ExtraHosts": [],
            "GroupAdd": null,
            "IpcMode": "private",
            "Cgroup": "",
            "Links": null,
            "OomScoreAdj": 0,
            "PidMode": "",
            "Privileged": false,
            "PublishAllPorts": false,
            "ReadonlyRootfs": false,
            "SecurityOpt": [
                "no-new-privileges:true"
            ],
            "UTSMode": "",
            "UsernsMode": "",
            "ShmSize": 67108864,
            "Runtime": "runc",
            "Isolation": "",
            "CpuShares": 0,
            "Memory": 1073741824,
            "NanoCpus": 1500000000,
            "CgroupParent": "",
            "BlkioWeight": 0,
            "BlkioWeightDevice": null,
            "BlkioDeviceReadBps": null,
            "BlkioDeviceWriteBps": null,
            "BlkioDeviceReadIOps": null,
            "BlkioDeviceWriteIOps": null,
            "CpuPeriod": 0,
            "CpuQuota": 0,
            "CpuRealtimePeriod": 0,
            "CpuRealtimeRuntime": 0,
            "CpusetCpus": "",
            "CpusetMems": "",
            "Devices": null,
            "DeviceCgroupRules": null,
            "DeviceRequests": null,
            "MemoryReservation": 0,
            "MemorySwap": 2147483648,
            "MemorySwappiness": null,
            "OomKillDisable": null,
            "PidsLimit": null,
            "Ulimits": null,
            "CpuCount": 0,
            "CpuPercent": 0,
            "IOMaximumIOps": 0,
            "IOMaximumBandwidth": 0,
            "MaskedPaths": [
                "/proc/acpi",
                "/proc/asound",
                "/proc/interrupts",
                "/proc/kcore",
                "/proc/keys",
                "/proc/latency_stats",
                "/proc/sched_debug",
                "/proc/scsi",
                "/proc/timer_list",
                "/proc/timer_stats",
                "/sys/devices/virtual/powercap",
                "/sys/firmware"
            ],
            "ReadonlyPaths": [
                "/proc/bus",
                "/proc/fs",
                "/proc/irq",
                "/proc/sys",
                "/proc/sysrq-trigger"
            ]
        },
        "GraphDriver": {
            "Data": {
                "ID": "50e2816bfd19977d0c51ef8446c5759e083616393e49c07b1c52c19e63b3470b",
                "LowerDir": "/var/lib/docker/overlay2/a92fee8670e1eda00755cda9f95dc00b78938ae9b685e25c167cbde1dc5cb9a0-init/diff:/var/lib/docker/overlay2/lfshy4bz6onh2ztq4qjx245ef/diff:/var/lib/docker/overlay2/z672aooyiemjp4aen99h7x4bb/diff:/var/lib/docker/overlay2/wg19ysinoa8hwuxpkr219z8hb/diff:/var/lib/docker/overlay2/b4ewm7j0xiyu6alhm4xfkzky3/diff:/var/lib/docker/overlay2/wpiduu9pxd4pv7ufpa4hk31dp/diff:/var/lib/docker/overlay2/xxvgz2kvmseo2gk9qeue6jinj/diff:/var/lib/docker/overlay2/u2tm4wi37ukuid95c2zn66711/diff:/var/lib/docker/overlay2/5c3vi7vsgud9fd6tex1zz15t5/diff:/var/lib/docker/overlay2/knsbxyn00j9sguzuo8hko2ans/diff:/var/lib/docker/overlay2/7gzj4c4dtgc88ddnhos6o0ggi/diff:/var/lib/docker/overlay2/8ed60a4496de1672027b59530d5fbb3d6d6075e2b3581b589c86502bad5229c5/diff:/var/lib/docker/overlay2/0425cc4a958c0eb91d61dbec830a422fadf41e07ba4436aa05e6246a7407bafd/diff:/var/lib/docker/overlay2/7ee8eda652e43d72c344c1e51c0405783cb68181481731c86eaf1de8abaa0950/diff:/var/lib/docker/overlay2/8fc67f38194de09b879e7b56334bffa27598204a60554a6512aabce9a84221f5/diff",
                "MergedDir": "/var/lib/docker/overlay2/a92fee8670e1eda00755cda9f95dc00b78938ae9b685e25c167cbde1dc5cb9a0/merged",
                "UpperDir": "/var/lib/docker/overlay2/a92fee8670e1eda00755cda9f95dc00b78938ae9b685e25c167cbde1dc5cb9a0/diff",
                "WorkDir": "/var/lib/docker/overlay2/a92fee8670e1eda00755cda9f95dc00b78938ae9b685e25c167cbde1dc5cb9a0/work"
            },
            "Name": "overlay2"
        },
        "Mounts": [
            {
                "Type": "bind",
                "Source": "/run/desktop/mnt/host/e/GSentinelHealthOS/MB-Chat/data",
                "Destination": "/app/artifacts/mb-chat-learning",
                "Mode": "rw",
                "RW": true,
                "Propagation": "rprivate"
            },
            {
                "Type": "volume",
                "Name": "gsentinelhealthos_uploads_data",
                "Source": "/var/lib/docker/volumes/gsentinelhealthos_uploads_data/_data",
                "Destination": "/data/uploads",
                "Driver": "local",
                "Mode": "rw",
                "RW": true,
                "Propagation": ""
            }
        ],
        "Config": {
            "Hostname": "50e2816bfd19",
            "Domainname": "",
            "User": "appuser",
            "AttachStdin": false,
            "AttachStdout": true,
            "AttachStderr": true,
            "ExposedPorts": {
                "8001/tcp": {}
            },
            "Tty": false,
            "OpenStdin": false,
            "StdinOnce": false,
            "Env": [
                "BRAIN_PORT=8001",
                "REDIS_CACHE_PREFIX=cache:",
                "DIALOGUE_ENGINE_URL=http://dialogue-engine:8010",
                "ENABLE_BRAIN_REDIS_WORKER=true",
                "BRAIN_ALLOWED_ORIGINS=http://localhost:3000,http://frontend:3000",
                "DECISION_SERVICE_URL=http://decision-service:8012",
                "INFERENCE_SERVICE_URL=http://inference-service:8011",
                "REDIS_SENTINEL_PASSWORD=bDAhxY9Af2LcR86iXN7U9gBIDpGeVuaiiKPLBTvEqLP2vbvy",
                "REDIS_SENTINEL_MASTER=mymaster",
                "NLG_SERVICE_URL=http://nlg-service:8013",
                "BRAIN_API_KEY=BRAIN_KEY_REDACTED",
                "REDIS_QUEUE_PREFIX=queue:",
                "INTERNAL_SERVICES_KEY=INTERNAL_KEY_REDACTED",
                "REDIS_URL=redis://:bDAhxY9Af2LcR86iXN7U9gBIDpGeVuaiiKPLBTvEqLP2vbvy@redis-master:6379",
                "DATABASE_URL=postgresql+psycopg://sentinel:OzMTDZYpxmFNivfGStWo0kB6Xb85Uweh@db:5432/gsentinel",
                "ENV=production",
                "REDIS_SENTINELS=redis-sentinel-1:26379,redis-sentinel-2:26379,redis-sentinel-3:26379",
                "LOG_FORMAT=json",
                "BRAIN_STATE_TTL_SECONDS=86400",
                "BRAIN_HOST=0.0.0.0",
                "BRAIN_MODE=http",
                "REDIS_STATE_PREFIX=state:",
                "API_BASE_URL=http://api:8000",
                "MEDICAL_CHAT_LEARNING_PATH=/app/artifacts/mb-chat-learning/medical-chat-learning.jsonl",
                "LOG_LEVEL=INFO",
                "PATH=/usr/local/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
                "LANG=C.UTF-8",
                "GPG_KEY=A035C8C19219BA821ECEA86B64E628F8D684696D",
                "PYTHON_VERSION=3.11.11",
                "PYTHON_SHA256=2a9920c7a0cd236de33644ed980a13cbbc21058bfdc528febb6081575ed73be3",
                "PYTHONPATH=/app",
                "PYTHONUNBUFFERED=1"
            ],
            "Cmd": [
                "python",
                "brain/main.py"
            ],
            "Healthcheck": {
                "Test": [
                    "CMD-SHELL",
                    "python -c \"import urllib.request; urllib.request.urlopen('http://localhost:8001/health')\" || exit 1"
                ],
                "Interval": 30000000000,
                "Timeout": 5000000000,
                "Retries": 3
            },
            "Image": "gsentinelhealthos-brain",
            "Volumes": null,
            "WorkingDir": "/app",
            "Entrypoint": null,
            "Labels": {
                "com.docker.compose.config-hash": "e6e6a6a0633ce4f49f1d1e59c3660fd1b35dfe2476323088e89e881f88268325",
                "com.docker.compose.container-number": "1",
                "com.docker.compose.depends_on": "redis-master:service_healthy:false,redis-sentinel-1:service_healthy:false,api:service_healthy:false,db:service_healthy:false",
                "com.docker.compose.image": "sha256:659ad05b1ff409a28ef2ef301f49e96c797290cd890e347cde2325be895781d7",
                "com.docker.compose.oneoff": "False",
                "com.docker.compose.project": "gsentinelhealthos",
                "com.docker.compose.project.config_files": "E:\\GSentinelHealthOS\\docker-compose.yml",
                "com.docker.compose.project.working_dir": "E:\\GSentinelHealthOS",
                "com.docker.compose.replace": "gs_brain",
                "com.docker.compose.service": "brain",
                "com.docker.compose.version": "5.1.0"
            },
            "StopTimeout": 1
        },
        "NetworkSettings": {
            "SandboxID": "bc67915746bb745a24c840999435fa63e06fe6db820a51d128caf2084806486b",
            "SandboxKey": "/var/run/docker/netns/bc67915746bb",
            "Ports": {
                "8001/tcp": []
            },
            "Networks": {
                "gsentinelhealthos_gs_prod": {
                    "IPAMConfig": null,
                    "Links": null,
                    "Aliases": [
                        "gs_brain",
                        "brain"
                    ],
                    "DriverOpts": null,
                    "GwPriority": 0,
                    "NetworkID": "919bd5f232a0b0588e6ca20e3c563d7ca6731d36e1524f9f82fd1a1f698a1813",
                    "EndpointID": "94c9f2ca1c53dc7f76734c7dc731bfb0df25f2e1ecc8ca1f4e9c42f905b0c045",
                    "Gateway": "172.20.0.1",
                    "IPAddress": "172.20.0.13",
                    "MacAddress": "96:3e:9a:e8:74:0e",
                    "IPPrefixLen": 16,
                    "IPv6Gateway": "",
                    "GlobalIPv6Address": "",
                    "GlobalIPv6PrefixLen": 0,
                    "DNSNames": [
                        "gs_brain",
                        "brain",
                        "50e2816bfd19"
                    ]
                }
            }
        }
    },
    {
        "Id": "600e46919576f7618b31fd7acfa243fd9bb0422c38867cbebdf0c879dfa8a85f",
        "Created": "2026-05-17T20:50:57.410310281Z",
        "Path": "uvicorn",
        "Args": [
            "api.app.main:app",
            "--host",
            "0.0.0.0",
            "--port",
            "8000"
        ],
        "State": {
            "Status": "running",
            "Running": true,
            "Paused": false,
            "Restarting": false,
            "OOMKilled": false,
            "Dead": false,
            "Pid": 1082,
            "ExitCode": 0,
            "Error": "",
            "StartedAt": "2026-05-18T21:45:20.013955613Z",
            "FinishedAt": "2026-05-18T21:45:16.194971671Z",
            "Health": {
                "Status": "healthy",
                "FailingStreak": 0,
                "Log": [
                    {
                        "Start": "2026-05-19T03:08:35.770743793Z",
                        "End": "2026-05-19T03:08:35.994076927Z",
                        "ExitCode": 0,
                        "Output": ""
                    },
                    {
                        "Start": "2026-05-19T03:09:05.904774758Z",
                        "End": "2026-05-19T03:09:06.033065329Z",
                        "ExitCode": 0,
                        "Output": ""
                    },
                    {
                        "Start": "2026-05-19T03:09:35.912575945Z",
                        "End": "2026-05-19T03:09:36.028065254Z",
                        "ExitCode": 0,
                        "Output": ""
                    },
                    {
                        "Start": "2026-05-19T03:10:05.944016127Z",
                        "End": "2026-05-19T03:10:06.089836606Z",
                        "ExitCode": 0,
                        "Output": ""
                    },
                    {
                        "Start": "2026-05-19T03:10:36.008805519Z",
                        "End": "2026-05-19T03:10:36.150284308Z",
                        "ExitCode": 0,
                        "Output": ""
                    }
                ]
            }
        },
        "Image": "sha256:d161e377ca90ff89c378d601ee4add2d60a2e7d0291020fcedb09ab08ab9fde4",
        "ResolvConfPath": "/var/lib/docker/containers/600e46919576f7618b31fd7acfa243fd9bb0422c38867cbebdf0c879dfa8a85f/resolv.conf",
        "HostnamePath": "/var/lib/docker/containers/600e46919576f7618b31fd7acfa243fd9bb0422c38867cbebdf0c879dfa8a85f/hostname",
        "HostsPath": "/var/lib/docker/containers/600e46919576f7618b31fd7acfa243fd9bb0422c38867cbebdf0c879dfa8a85f/hosts",
        "LogPath": "/var/lib/docker/containers/600e46919576f7618b31fd7acfa243fd9bb0422c38867cbebdf0c879dfa8a85f/600e46919576f7618b31fd7acfa243fd9bb0422c38867cbebdf0c879dfa8a85f-json.log",
        "Name": "/gs_api",
        "RestartCount": 0,
        "Driver": "overlay2",
        "Platform": "linux",
        "MountLabel": "",
        "ProcessLabel": "",
        "AppArmorProfile": "",
        "ExecIDs": null,
        "HostConfig": {
            "Binds": [
                "gsentinelhealthos_uploads_data:/data/uploads:rw"
            ],
            "ContainerIDFile": "",
            "LogConfig": {
                "Type": "json-file",
                "Config": {
                    "max-file": "3",
                    "max-size": "10m"
                }
            },
            "NetworkMode": "gsentinelhealthos_gs_prod",
            "PortBindings": {
                "8000/tcp": [
                    {
                        "HostIp": "127.0.0.1",
                        "HostPort": "8000"
                    }
                ]
            },
            "RestartPolicy": {
                "Name": "unless-stopped",
                "MaximumRetryCount": 0
            },
            "AutoRemove": false,
            "VolumeDriver": "",
            "VolumesFrom": null,
            "ConsoleSize": [
                0,
                0
            ],
            "CapAdd": null,
            "CapDrop": null,
            "CgroupnsMode": "private",
            "Dns": [],
            "DnsOptions": [],
            "DnsSearch": [],
            "ExtraHosts": [],
            "GroupAdd": null,
            "IpcMode": "private",
            "Cgroup": "",
            "Links": null,
            "OomScoreAdj": 0,
            "PidMode": "",
            "Privileged": false,
            "PublishAllPorts": false,
            "ReadonlyRootfs": false,
            "SecurityOpt": [
                "no-new-privileges:true"
            ],
            "UTSMode": "",
            "UsernsMode": "",
            "ShmSize": 67108864,
            "Runtime": "runc",
            "Isolation": "",
            "CpuShares": 0,
            "Memory": 805306368,
            "NanoCpus": 1000000000,
            "CgroupParent": "",
            "BlkioWeight": 0,
            "BlkioWeightDevice": null,
            "BlkioDeviceReadBps": null,
            "BlkioDeviceWriteBps": null,
            "BlkioDeviceReadIOps": null,
            "BlkioDeviceWriteIOps": null,
            "CpuPeriod": 0,
            "CpuQuota": 0,
            "CpuRealtimePeriod": 0,
            "CpuRealtimeRuntime": 0,
            "CpusetCpus": "",
            "CpusetMems": "",
            "Devices": null,
            "DeviceCgroupRules": null,
            "DeviceRequests": null,
            "MemoryReservation": 0,
            "MemorySwap": 1610612736,
            "MemorySwappiness": null,
            "OomKillDisable": null,
            "PidsLimit": null,
            "Ulimits": null,
            "CpuCount": 0,
            "CpuPercent": 0,
            "IOMaximumIOps": 0,
            "IOMaximumBandwidth": 0,
            "MaskedPaths": [
                "/proc/acpi",
                "/proc/asound",
                "/proc/interrupts",
                "/proc/kcore",
                "/proc/keys",
                "/proc/latency_stats",
                "/proc/sched_debug",
                "/proc/scsi",
                "/proc/timer_list",
                "/proc/timer_stats",
                "/sys/devices/virtual/powercap",
                "/sys/firmware"
            ],
            "ReadonlyPaths": [
                "/proc/bus",
                "/proc/fs",
                "/proc/irq",
                "/proc/sys",
                "/proc/sysrq-trigger"
            ]
        },
        "GraphDriver": {
            "Data": {
                "ID": "600e46919576f7618b31fd7acfa243fd9bb0422c38867cbebdf0c879dfa8a85f",
                "LowerDir": "/var/lib/docker/overlay2/239140abc5e4344dd2478f1ddb0d2a0abaa2dfbfd9d9660f501bfaa03b22269c-init/diff:/var/lib/docker/overlay2/4chm5xij87h4uhayth0v1ctax/diff:/var/lib/docker/overlay2/m1afn2r2aw48r40t4xqq932zy/diff:/var/lib/docker/overlay2/6g8ljmjmq979nqhn2h4xdwpo6/diff:/var/lib/docker/overlay2/xelx59rhn0n41ogy04eunsshq/diff:/var/lib/docker/overlay2/rf6rii3c0u3otbppz44qios05/diff:/var/lib/docker/overlay2/0xifs7ldcm09i0hjauh303jei/diff:/var/lib/docker/overlay2/pl4yuusiyaauj80v7u3erlja8/diff:/var/lib/docker/overlay2/nxx1ahwodeepo7c6h7s204z6q/diff:/var/lib/docker/overlay2/f9aut02bajsf1glrb4blr1rpn/diff:/var/lib/docker/overlay2/qn6m1o1254n7js9npf32v6end/diff:/var/lib/docker/overlay2/7gzj4c4dtgc88ddnhos6o0ggi/diff:/var/lib/docker/overlay2/8ed60a4496de1672027b59530d5fbb3d6d6075e2b3581b589c86502bad5229c5/diff:/var/lib/docker/overlay2/0425cc4a958c0eb91d61dbec830a422fadf41e07ba4436aa05e6246a7407bafd/diff:/var/lib/docker/overlay2/7ee8eda652e43d72c344c1e51c0405783cb68181481731c86eaf1de8abaa0950/diff:/var/lib/docker/overlay2/8fc67f38194de09b879e7b56334bffa27598204a60554a6512aabce9a84221f5/diff",
                "MergedDir": "/var/lib/docker/overlay2/239140abc5e4344dd2478f1ddb0d2a0abaa2dfbfd9d9660f501bfaa03b22269c/merged",
                "UpperDir": "/var/lib/docker/overlay2/239140abc5e4344dd2478f1ddb0d2a0abaa2dfbfd9d9660f501bfaa03b22269c/diff",
                "WorkDir": "/var/lib/docker/overlay2/239140abc5e4344dd2478f1ddb0d2a0abaa2dfbfd9d9660f501bfaa03b22269c/work"
            },
            "Name": "overlay2"
        },
        "Mounts": [
            {
                "Type": "volume",
                "Name": "gsentinelhealthos_uploads_data",
                "Source": "/var/lib/docker/volumes/gsentinelhealthos_uploads_data/_data",
                "Destination": "/data/uploads",
                "Driver": "local",
                "Mode": "rw",
                "RW": true,
                "Propagation": ""
            }
        ],
        "Config": {
            "Hostname": "600e46919576",
            "Domainname": "",
            "User": "appuser",
            "AttachStdin": false,
            "AttachStdout": true,
            "AttachStderr": true,
            "ExposedPorts": {
                "8000/tcp": {}
            },
            "Tty": false,
            "OpenStdin": false,
            "StdinOnce": false,
            "Env": [
                "REDIS_SENTINELS=redis-sentinel-1:26379,redis-sentinel-2:26379,redis-sentinel-3:26379",
                "META_APP_ID=",
                "RATE_LIMIT_PER_MINUTE=200",
                "REDIS_QUEUE_PREFIX=queue:",
                "WHATSAPP_API_VERSION=v25.0",
                "REDIS_SENTINEL_PASSWORD=bDAhxY9Af2LcR86iXN7U9gBIDpGeVuaiiKPLBTvEqLP2vbvy",
                "JWT_AUDIENCE=gsentinel-clients",
                "JWT_SECRET=fGd8p7xXW3FtuPco5zM4QOsHlmwgNKiJ9TrvYCEnab2Z1LqS",
                "META_APP_SECRET=",
                "LOG_LEVEL=INFO",
                "REDIS_URL=redis://:bDAhxY9Af2LcR86iXN7U9gBIDpGeVuaiiKPLBTvEqLP2vbvy@redis-master:6379",
                "ENV=production",
                "WHATSAPP_APP_SECRET=5c2881d5ddb3ccd833ae5cd935dda230",
                "SECRET_ENCRYPTION_KEY=Rd0JhO5AyXmMD89fPSNt6zjKxiF1cbo2",
                "WHATSAPP_BUSINESS_ACCOUNT_ID=967835399226590",
                "WHATSAPP_PHONE_NUMBER_ID=1093032243892458",
                "REDIS_SENTINEL_MASTER=mymaster",
                "META_GRAPH_API_VERSION=v21.0",
                "JWT_ISSUER=gsentinel-api",
                "DATABASE_URL=postgresql+psycopg://sentinel:OzMTDZYpxmFNivfGStWo0kB6Xb85Uweh@db:5432/gsentinel",
                "LOG_FORMAT=json",
                "REDIS_STATE_PREFIX=state:",
                "GATEWAY_API_KEY=GATEWAY_KEY_REDACTED",
                "INTERNAL_SERVICES_KEY=INTERNAL_KEY_REDACTED",
                "WHATSAPP_VERIFY_TOKEN=Em-10Taz812-Agus2026",
                "BRAIN_API_KEY=BRAIN_KEY_REDACTED",
                "META_EMBEDDED_SIGNUP_CONFIGURATION_ID=",
                "META_OAUTH_REDIRECT_URI=",
                "REDIS_CACHE_PREFIX=cache:",
                "WHATSAPP_ACCESS_TOKEN=EAARicVwKsqYBRYZAXPvOsEIPrtv28oSZANK28L4SxThrTcfwCVg3JLCFvqKDeSjgDNyIFtiTd1J8ll7kmfXKD9A0ZCAUE6MoSvvJ2IuVkW8aaoLdcmzN5Yl1kPZClK3dxUZCvZCOuju33QtWy4wxtMvZCyqsQpuLrixutEpNM5CNIFBZCUaOzh5jSDF8UwwXnQZDZD",
                "PATH=/usr/local/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
                "LANG=C.UTF-8",
                "GPG_KEY=A035C8C19219BA821ECEA86B64E628F8D684696D",
                "PYTHON_VERSION=3.11.11",
                "PYTHON_SHA256=2a9920c7a0cd236de33644ed980a13cbbc21058bfdc528febb6081575ed73be3"
            ],
            "Cmd": [
                "uvicorn",
                "api.app.main:app",
                "--host",
                "0.0.0.0",
                "--port",
                "8000"
            ],
            "Healthcheck": {
                "Test": [
                    "CMD-SHELL",
                    "python -c \"import urllib.request; urllib.request.urlopen('http://localhost:8000/api/health/liveness')\" || exit 1"
                ],
                "Interval": 30000000000,
                "Timeout": 5000000000,
                "StartPeriod": 5000000000,
                "Retries": 3
            },
            "Image": "gsentinelhealthos-api",
            "Volumes": null,
            "WorkingDir": "/app",
            "Entrypoint": null,
            "Labels": {
                "com.docker.compose.config-hash": "863377063f488833644242f35322653c4bbb03884bb4c67d4fe32927938bff84",
                "com.docker.compose.container-number": "1",
                "com.docker.compose.depends_on": "redis-master:service_healthy:false,redis-sentinel-1:service_healthy:false,db:service_healthy:false,migrate-api:service_completed_successfully:false",
                "com.docker.compose.image": "sha256:d161e377ca90ff89c378d601ee4add2d60a2e7d0291020fcedb09ab08ab9fde4",
                "com.docker.compose.oneoff": "False",
                "com.docker.compose.project": "gsentinelhealthos",
                "com.docker.compose.project.config_files": "E:\\GSentinelHealthOS\\docker-compose.yml",
                "com.docker.compose.project.working_dir": "E:\\GSentinelHealthOS",
                "com.docker.compose.replace": "gs_api",
                "com.docker.compose.service": "api",
                "com.docker.compose.version": "5.1.0"
            },
            "StopTimeout": 1
        },
        "NetworkSettings": {
            "SandboxID": "5cea5bc2721c4463621432f84fa2fe790a28691e9b215db480311207580208b9",
            "SandboxKey": "/var/run/docker/netns/5cea5bc2721c",
            "Ports": {
                "8000/tcp": [
                    {
                        "HostIp": "127.0.0.1",
                        "HostPort": "8000"
                    }
                ]
            },
            "Networks": {
                "gsentinelhealthos_gs_prod": {
                    "IPAMConfig": null,
                    "Links": null,
                    "Aliases": [
                        "gs_api",
                        "api"
                    ],
                    "DriverOpts": null,
                    "GwPriority": 0,
                    "NetworkID": "919bd5f232a0b0588e6ca20e3c563d7ca6731d36e1524f9f82fd1a1f698a1813",
                    "EndpointID": "1cd727a00345b0b675821eff058d8528282143537614cf8ac1ee07c19457ccea",
                    "Gateway": "172.20.0.1",
                    "IPAddress": "172.20.0.4",
                    "MacAddress": "16:88:c0:b0:3d:6b",
                    "IPPrefixLen": 16,
                    "IPv6Gateway": "",
                    "GlobalIPv6Address": "",
                    "GlobalIPv6PrefixLen": 0,
                    "DNSNames": [
                        "gs_api",
                        "api",
                        "600e46919576"
                    ]
                }
            }
        }
    },
    {
        "Id": "e207bb357c0d79b639fc9a0000ff3a86fea2767913b20e8e0f62bfae643a93e1",
        "Created": "2026-05-17T20:50:54.354880155Z",
        "Path": "docker-entrypoint.sh",
        "Args": [
            "sh",
            "-c",
            "cp /usr/local/etc/redis/sentinel.conf /tmp/sentinel.conf \u0026\u0026 printf '\nsentinel auth-pass mymaster %s\n' \"$REDIS_PASSWORD\" \u003e\u003e /tmp/sentinel.conf \u0026\u0026 redis-server /tmp/sentinel.conf --sentinel"
        ],
        "State": {
            "Status": "running",
            "Running": true,
            "Paused": false,
            "Restarting": false,
            "OOMKilled": false,
            "Dead": false,
            "Pid": 1092,
            "ExitCode": 0,
            "Error": "",
            "StartedAt": "2026-05-18T21:45:19.918919597Z",
            "FinishedAt": "2026-05-18T21:45:16.194684464Z",
            "Health": {
                "Status": "healthy",
                "FailingStreak": 0,
                "Log": [
                    {
                        "Start": "2026-05-19T03:10:07.779008771Z",
                        "End": "2026-05-19T03:10:07.856914586Z",
                        "ExitCode": 0,
                        "Output": "Warning: Using a password with '-a' or '-u' option on the command line interface may not be safe.\nAUTH failed: ERR AUTH \u003cpassword\u003e called without any password configured for the default user. Are you sure your configuration is correct?\nPONG\n"
                    },
                    {
                        "Start": "2026-05-19T03:10:17.858107231Z",
                        "End": "2026-05-19T03:10:17.974487294Z",
                        "ExitCode": 0,
                        "Output": "Warning: Using a password with '-a' or '-u' option on the command line interface may not be safe.\nAUTH failed: ERR AUTH \u003cpassword\u003e called without any password configured for the default user. Are you sure your configuration is correct?\nPONG\n"
                    },
                    {
                        "Start": "2026-05-19T03:10:27.975240644Z",
                        "End": "2026-05-19T03:10:28.076290122Z",
                        "ExitCode": 0,
                        "Output": "Warning: Using a password with '-a' or '-u' option on the command line interface may not be safe.\nAUTH failed: ERR AUTH \u003cpassword\u003e called without any password configured for the default user. Are you sure your configuration is correct?\nPONG\n"
                    },
                    {
                        "Start": "2026-05-19T03:10:37.995057319Z",
                        "End": "2026-05-19T03:10:38.062577103Z",
                        "ExitCode": 0,
                        "Output": "Warning: Using a password with '-a' or '-u' option on the command line interface may not be safe.\nAUTH failed: ERR AUTH \u003cpassword\u003e called without any password configured for the default user. Are you sure your configuration is correct?\nPONG\n"
                    },
                    {
                        "Start": "2026-05-19T03:10:48.063300085Z",
                        "End": "2026-05-19T03:10:48.121460695Z",
                        "ExitCode": 0,
                        "Output": "Warning: Using a password with '-a' or '-u' option on the command line interface may not be safe.\nAUTH failed: ERR AUTH \u003cpassword\u003e called without any password configured for the default user. Are you sure your configuration is correct?\nPONG\n"
                    }
                ]
            }
        },
        "Image": "sha256:e74faa347ab0b6a3c1b040834a35ea5f20e3aa02460db4bb9d5b4685f3dd3baf",
        "ResolvConfPath": "/var/lib/docker/containers/e207bb357c0d79b639fc9a0000ff3a86fea2767913b20e8e0f62bfae643a93e1/resolv.conf",
        "HostnamePath": "/var/lib/docker/containers/e207bb357c0d79b639fc9a0000ff3a86fea2767913b20e8e0f62bfae643a93e1/hostname",
        "HostsPath": "/var/lib/docker/containers/e207bb357c0d79b639fc9a0000ff3a86fea2767913b20e8e0f62bfae643a93e1/hosts",
        "LogPath": "/var/lib/docker/containers/e207bb357c0d79b639fc9a0000ff3a86fea2767913b20e8e0f62bfae643a93e1/e207bb357c0d79b639fc9a0000ff3a86fea2767913b20e8e0f62bfae643a93e1-json.log",
        "Name": "/gs_redis_sentinel_1",
        "RestartCount": 0,
        "Driver": "overlay2",
        "Platform": "linux",
        "MountLabel": "",
        "ProcessLabel": "",
        "AppArmorProfile": "",
        "ExecIDs": null,
        "HostConfig": {
            "Binds": [
                "E:\\GSentinelHealthOS\\broker\\sentinel.conf:/usr/local/etc/redis/sentinel.conf:ro"
            ],
            "ContainerIDFile": "",
            "LogConfig": {
                "Type": "json-file",
                "Config": {
                    "max-file": "2",
                    "max-size": "5m"
                }
            },
            "NetworkMode": "gsentinelhealthos_gs_prod",
            "PortBindings": {},
            "RestartPolicy": {
                "Name": "unless-stopped",
                "MaximumRetryCount": 0
            },
            "AutoRemove": false,
            "VolumeDriver": "",
            "VolumesFrom": null,
            "ConsoleSize": [
                0,
                0
            ],
            "CapAdd": null,
            "CapDrop": null,
            "CgroupnsMode": "private",
            "Dns": [],
            "DnsOptions": [],
            "DnsSearch": [],
            "ExtraHosts": [],
            "GroupAdd": null,
            "IpcMode": "private",
            "Cgroup": "",
            "Links": null,
            "OomScoreAdj": 0,
            "PidMode": "",
            "Privileged": false,
            "PublishAllPorts": false,
            "ReadonlyRootfs": false,
            "SecurityOpt": [
                "no-new-privileges:true"
            ],
            "UTSMode": "",
            "UsernsMode": "",
            "ShmSize": 67108864,
            "Runtime": "runc",
            "Isolation": "",
            "CpuShares": 0,
            "Memory": 134217728,
            "NanoCpus": 250000000,
            "CgroupParent": "",
            "BlkioWeight": 0,
            "BlkioWeightDevice": null,
            "BlkioDeviceReadBps": null,
            "BlkioDeviceWriteBps": null,
            "BlkioDeviceReadIOps": null,
            "BlkioDeviceWriteIOps": null,
            "CpuPeriod": 0,
            "CpuQuota": 0,
            "CpuRealtimePeriod": 0,
            "CpuRealtimeRuntime": 0,
            "CpusetCpus": "",
            "CpusetMems": "",
            "Devices": null,
            "DeviceCgroupRules": null,
            "DeviceRequests": null,
            "MemoryReservation": 0,
            "MemorySwap": 268435456,
            "MemorySwappiness": null,
            "OomKillDisable": null,
            "PidsLimit": null,
            "Ulimits": null,
            "CpuCount": 0,
            "CpuPercent": 0,
            "IOMaximumIOps": 0,
            "IOMaximumBandwidth": 0,
            "Mounts": [
                {
                    "Type": "volume",
                    "Source": "fd71a40b8a3b609282459400207ab018f42a4fb8a7352ec47496b53384e058af",
                    "Target": "/data"
                }
            ],
            "MaskedPaths": [
                "/proc/acpi",
                "/proc/asound",
                "/proc/interrupts",
                "/proc/kcore",
                "/proc/keys",
                "/proc/latency_stats",
                "/proc/sched_debug",
                "/proc/scsi",
                "/proc/timer_list",
                "/proc/timer_stats",
                "/sys/devices/virtual/powercap",
                "/sys/firmware"
            ],
            "ReadonlyPaths": [
                "/proc/bus",
                "/proc/fs",
                "/proc/irq",
                "/proc/sys",
                "/proc/sysrq-trigger"
            ]
        },
        "GraphDriver": {
            "Data": {
                "ID": "e207bb357c0d79b639fc9a0000ff3a86fea2767913b20e8e0f62bfae643a93e1",
                "LowerDir": "/var/lib/docker/overlay2/7c256950e1ca5bcbb3068e10d1b389a038d839f1a0e17dc5bcb16b7f961ec327-init/diff:/var/lib/docker/overlay2/8c9090380150b4636f6319b5c2b8adc07efaca5df68e948e6418fd36c142f49d/diff:/var/lib/docker/overlay2/e85f396d82ffc5d990826d062fe059185779692ff70111fe596efb62c2876923/diff:/var/lib/docker/overlay2/8cca02262c9f2436236c122d7e63eba78ab4be5b77971c372934efcb7bf5bdf1/diff:/var/lib/docker/overlay2/7267c3d380a80502ea27c1cf22254c597730fa6f0bf94e8b9fcb6dd189c771a1/diff:/var/lib/docker/overlay2/6de7058bf8829c0201fb6b07e6f1b2b08c8be1068e686abc36ee6a8175fd320f/diff:/var/lib/docker/overlay2/4f0da3802045cf986cc9b74d1eeb229e70ab60670cef9f9fbd9b6a77ae4c0ea2/diff:/var/lib/docker/overlay2/fccffb1cd9ddd708bbb163c23a68583fc17fda15258ccaf798f28f97bbe2319d/diff",
                "MergedDir": "/var/lib/docker/overlay2/7c256950e1ca5bcbb3068e10d1b389a038d839f1a0e17dc5bcb16b7f961ec327/merged",
                "UpperDir": "/var/lib/docker/overlay2/7c256950e1ca5bcbb3068e10d1b389a038d839f1a0e17dc5bcb16b7f961ec327/diff",
                "WorkDir": "/var/lib/docker/overlay2/7c256950e1ca5bcbb3068e10d1b389a038d839f1a0e17dc5bcb16b7f961ec327/work"
            },
            "Name": "overlay2"
        },
        "Mounts": [
            {
                "Type": "volume",
                "Name": "fd71a40b8a3b609282459400207ab018f42a4fb8a7352ec47496b53384e058af",
                "Source": "/var/lib/docker/volumes/fd71a40b8a3b609282459400207ab018f42a4fb8a7352ec47496b53384e058af/_data",
                "Destination": "/data",
                "Driver": "local",
                "Mode": "z",
                "RW": true,
                "Propagation": ""
            },
            {
                "Type": "bind",
                "Source": "E:\\GSentinelHealthOS\\broker\\sentinel.conf",
                "Destination": "/usr/local/etc/redis/sentinel.conf",
                "Mode": "ro",
                "RW": false,
                "Propagation": "rprivate"
            }
        ],
        "Config": {
            "Hostname": "e207bb357c0d",
            "Domainname": "",
            "User": "",
            "AttachStdin": false,
            "AttachStdout": true,
            "AttachStderr": true,
            "ExposedPorts": {
                "6379/tcp": {}
            },
            "Tty": false,
            "OpenStdin": false,
            "StdinOnce": false,
            "Env": [
                "REDIS_PASSWORD=bDAhxY9Af2LcR86iXN7U9gBIDpGeVuaiiKPLBTvEqLP2vbvy",
                "PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
                "REDIS_DOWNLOAD_URL=https://github.com/redis/redis/archive/refs/tags/8.0.2.tar.gz",
                "REDIS_DOWNLOAD_SHA=caf3c0069f06fc84c5153bd2a348b204c578de80490c73857bee01d9b5d7401f"
            ],
            "Cmd": [
                "sh",
                "-c",
                "cp /usr/local/etc/redis/sentinel.conf /tmp/sentinel.conf \u0026\u0026 printf '\nsentinel auth-pass mymaster %s\n' \"$REDIS_PASSWORD\" \u003e\u003e /tmp/sentinel.conf \u0026\u0026 redis-server /tmp/sentinel.conf --sentinel"
            ],
            "Healthcheck": {
                "Test": [
                    "CMD",
                    "sh",
                    "-c",
                    "redis-cli -h localhost -p 26379 -a \"$REDIS_PASSWORD\" ping"
                ],
                "Interval": 10000000000,
                "Timeout": 3000000000,
                "Retries": 5
            },
            "Image": "redis:8.0.2-alpine",
            "Volumes": {
                "/data": {}
            },
            "WorkingDir": "/data",
            "Entrypoint": [
                "docker-entrypoint.sh"
            ],
            "Labels": {
                "com.docker.compose.config-hash": "7b70c33466e79af5023d9bcae50d7e45439c370410f7c132489f4362874dccc8",
                "com.docker.compose.container-number": "1",
                "com.docker.compose.depends_on": "redis-replica:service_healthy:false,redis-master:service_healthy:false",
                "com.docker.compose.image": "sha256:e74faa347ab0b6a3c1b040834a35ea5f20e3aa02460db4bb9d5b4685f3dd3baf",
                "com.docker.compose.oneoff": "False",
                "com.docker.compose.project": "gsentinelhealthos",
                "com.docker.compose.project.config_files": "E:\\GSentinelHealthOS\\docker-compose.yml",
                "com.docker.compose.project.working_dir": "E:\\GSentinelHealthOS",
                "com.docker.compose.replace": "gs_redis_sentinel_1",
                "com.docker.compose.service": "redis-sentinel-1",
                "com.docker.compose.version": "5.1.0"
            },
            "StopTimeout": 1
        },
        "NetworkSettings": {
            "SandboxID": "9ee4d8ef35ac042cc4a42fc065bedb750d46934bdccc9293c085ae322b811f08",
            "SandboxKey": "/var/run/docker/netns/9ee4d8ef35ac",
            "Ports": {
                "6379/tcp": null
            },
            "Networks": {
                "gsentinelhealthos_gs_prod": {
                    "IPAMConfig": null,
                    "Links": null,
                    "Aliases": [
                        "gs_redis_sentinel_1",
                        "redis-sentinel-1"
                    ],
                    "DriverOpts": null,
                    "GwPriority": 0,
                    "NetworkID": "919bd5f232a0b0588e6ca20e3c563d7ca6731d36e1524f9f82fd1a1f698a1813",
                    "EndpointID": "b233f67bdbf8502c05741573c428350c7baaee1fa3b0e1e038d5efea629b64bd",
                    "Gateway": "172.20.0.1",
                    "IPAddress": "172.20.0.5",
                    "MacAddress": "86:6a:d4:b4:03:f0",
                    "IPPrefixLen": 16,
                    "IPv6Gateway": "",
                    "GlobalIPv6Address": "",
                    "GlobalIPv6PrefixLen": 0,
                    "DNSNames": [
                        "gs_redis_sentinel_1",
                        "redis-sentinel-1",
                        "e207bb357c0d"
                    ]
                }
            }
        }
    },
    {
        "Id": "5baf6f677c1ccf8954824a756c72bdeb3b7ddb2364d190fb96f3bb0bd52ef61b",
        "Created": "2026-05-17T20:50:50.368361963Z",
        "Path": "docker-entrypoint.sh",
        "Args": [
            "sh",
            "-c",
            "redis-server /usr/local/etc/redis/redis.conf --replicaof redis-master 6379 --masterauth \"bDAhxY9Af2LcR86iXN7U9gBIDpGeVuaiiKPLBTvEqLP2vbvy\" --requirepass \"bDAhxY9Af2LcR86iXN7U9gBIDpGeVuaiiKPLBTvEqLP2vbvy\""
        ],
        "State": {
            "Status": "running",
            "Running": true,
            "Paused": false,
            "Restarting": false,
            "OOMKilled": false,
            "Dead": false,
            "Pid": 1507,
            "ExitCode": 0,
            "Error": "",
            "StartedAt": "2026-05-18T21:45:20.134016345Z",
            "FinishedAt": "2026-05-18T21:45:16.194250373Z",
            "Health": {
                "Status": "healthy",
                "FailingStreak": 0,
                "Log": [
                    {
                        "Start": "2026-05-19T03:10:11.70108256Z",
                        "End": "2026-05-19T03:10:11.769151133Z",
                        "ExitCode": 0,
                        "Output": "Warning: Using a password with '-a' or '-u' option on the command line interface may not be safe.\nPONG\n"
                    },
                    {
                        "Start": "2026-05-19T03:10:21.770415727Z",
                        "End": "2026-05-19T03:10:21.836640851Z",
                        "ExitCode": 0,
                        "Output": "Warning: Using a password with '-a' or '-u' option on the command line interface may not be safe.\nPONG\n"
                    },
                    {
                        "Start": "2026-05-19T03:10:31.755355426Z",
                        "End": "2026-05-19T03:10:31.84810698Z",
                        "ExitCode": 0,
                        "Output": "Warning: Using a password with '-a' or '-u' option on the command line interface may not be safe.\nPONG\n"
                    },
                    {
                        "Start": "2026-05-19T03:10:41.849086143Z",
                        "End": "2026-05-19T03:10:41.91288537Z",
                        "ExitCode": 0,
                        "Output": "Warning: Using a password with '-a' or '-u' option on the command line interface may not be safe.\nPONG\n"
                    },
                    {
                        "Start": "2026-05-19T03:10:51.914450434Z",
                        "End": "2026-05-19T03:10:51.995193011Z",
                        "ExitCode": 0,
                        "Output": "Warning: Using a password with '-a' or '-u' option on the command line interface may not be safe.\nPONG\n"
                    }
                ]
            }
        },
        "Image": "sha256:e74faa347ab0b6a3c1b040834a35ea5f20e3aa02460db4bb9d5b4685f3dd3baf",
        "ResolvConfPath": "/var/lib/docker/containers/5baf6f677c1ccf8954824a756c72bdeb3b7ddb2364d190fb96f3bb0bd52ef61b/resolv.conf",
        "HostnamePath": "/var/lib/docker/containers/5baf6f677c1ccf8954824a756c72bdeb3b7ddb2364d190fb96f3bb0bd52ef61b/hostname",
        "HostsPath": "/var/lib/docker/containers/5baf6f677c1ccf8954824a756c72bdeb3b7ddb2364d190fb96f3bb0bd52ef61b/hosts",
        "LogPath": "/var/lib/docker/containers/5baf6f677c1ccf8954824a756c72bdeb3b7ddb2364d190fb96f3bb0bd52ef61b/5baf6f677c1ccf8954824a756c72bdeb3b7ddb2364d190fb96f3bb0bd52ef61b-json.log",
        "Name": "/gs_redis_replica",
        "RestartCount": 0,
        "Driver": "overlay2",
        "Platform": "linux",
        "MountLabel": "",
        "ProcessLabel": "",
        "AppArmorProfile": "",
        "ExecIDs": null,
        "HostConfig": {
            "Binds": [
                "gsentinelhealthos_redis_replica_data:/data:rw",
                "/run/desktop/mnt/host/e/GSentinelHealthOS/broker/redis.conf:/usr/local/etc/redis/redis.conf:ro"
            ],
            "ContainerIDFile": "",
            "LogConfig": {
                "Type": "json-file",
                "Config": {
                    "max-file": "3",
                    "max-size": "10m"
                }
            },
            "NetworkMode": "gsentinelhealthos_gs_prod",
            "PortBindings": {},
            "RestartPolicy": {
                "Name": "unless-stopped",
                "MaximumRetryCount": 0
            },
            "AutoRemove": false,
            "VolumeDriver": "",
            "VolumesFrom": null,
            "ConsoleSize": [
                0,
                0
            ],
            "CapAdd": null,
            "CapDrop": null,
            "CgroupnsMode": "private",
            "Dns": [],
            "DnsOptions": [],
            "DnsSearch": [],
            "ExtraHosts": [],
            "GroupAdd": null,
            "IpcMode": "private",
            "Cgroup": "",
            "Links": null,
            "OomScoreAdj": 0,
            "PidMode": "",
            "Privileged": false,
            "PublishAllPorts": false,
            "ReadonlyRootfs": false,
            "SecurityOpt": [
                "no-new-privileges:true"
            ],
            "UTSMode": "",
            "UsernsMode": "",
            "ShmSize": 67108864,
            "Runtime": "runc",
            "Isolation": "",
            "CpuShares": 0,
            "Memory": 536870912,
            "NanoCpus": 500000000,
            "CgroupParent": "",
            "BlkioWeight": 0,
            "BlkioWeightDevice": null,
            "BlkioDeviceReadBps": null,
            "BlkioDeviceWriteBps": null,
            "BlkioDeviceReadIOps": null,
            "BlkioDeviceWriteIOps": null,
            "CpuPeriod": 0,
            "CpuQuota": 0,
            "CpuRealtimePeriod": 0,
            "CpuRealtimeRuntime": 0,
            "CpusetCpus": "",
            "CpusetMems": "",
            "Devices": null,
            "DeviceCgroupRules": null,
            "DeviceRequests": null,
            "MemoryReservation": 0,
            "MemorySwap": 1073741824,
            "MemorySwappiness": null,
            "OomKillDisable": null,
            "PidsLimit": null,
            "Ulimits": null,
            "CpuCount": 0,
            "CpuPercent": 0,
            "IOMaximumIOps": 0,
            "IOMaximumBandwidth": 0,
            "MaskedPaths": [
                "/proc/acpi",
                "/proc/asound",
                "/proc/interrupts",
                "/proc/kcore",
                "/proc/keys",
                "/proc/latency_stats",
                "/proc/sched_debug",
                "/proc/scsi",
                "/proc/timer_list",
                "/proc/timer_stats",
                "/sys/devices/virtual/powercap",
                "/sys/firmware"
            ],
            "ReadonlyPaths": [
                "/proc/bus",
                "/proc/fs",
                "/proc/irq",
                "/proc/sys",
                "/proc/sysrq-trigger"
            ]
        },
        "GraphDriver": {
            "Data": {
                "ID": "5baf6f677c1ccf8954824a756c72bdeb3b7ddb2364d190fb96f3bb0bd52ef61b",
                "LowerDir": "/var/lib/docker/overlay2/d32efa7bd63eeea2139bcadd436ee1ecc1d3204dd97374e4bdff17501dec570f-init/diff:/var/lib/docker/overlay2/8c9090380150b4636f6319b5c2b8adc07efaca5df68e948e6418fd36c142f49d/diff:/var/lib/docker/overlay2/e85f396d82ffc5d990826d062fe059185779692ff70111fe596efb62c2876923/diff:/var/lib/docker/overlay2/8cca02262c9f2436236c122d7e63eba78ab4be5b77971c372934efcb7bf5bdf1/diff:/var/lib/docker/overlay2/7267c3d380a80502ea27c1cf22254c597730fa6f0bf94e8b9fcb6dd189c771a1/diff:/var/lib/docker/overlay2/6de7058bf8829c0201fb6b07e6f1b2b08c8be1068e686abc36ee6a8175fd320f/diff:/var/lib/docker/overlay2/4f0da3802045cf986cc9b74d1eeb229e70ab60670cef9f9fbd9b6a77ae4c0ea2/diff:/var/lib/docker/overlay2/fccffb1cd9ddd708bbb163c23a68583fc17fda15258ccaf798f28f97bbe2319d/diff",
                "MergedDir": "/var/lib/docker/overlay2/d32efa7bd63eeea2139bcadd436ee1ecc1d3204dd97374e4bdff17501dec570f/merged",
                "UpperDir": "/var/lib/docker/overlay2/d32efa7bd63eeea2139bcadd436ee1ecc1d3204dd97374e4bdff17501dec570f/diff",
                "WorkDir": "/var/lib/docker/overlay2/d32efa7bd63eeea2139bcadd436ee1ecc1d3204dd97374e4bdff17501dec570f/work"
            },
            "Name": "overlay2"
        },
        "Mounts": [
            {
                "Type": "volume",
                "Name": "gsentinelhealthos_redis_replica_data",
                "Source": "/var/lib/docker/volumes/gsentinelhealthos_redis_replica_data/_data",
                "Destination": "/data",
                "Driver": "local",
                "Mode": "rw",
                "RW": true,
                "Propagation": ""
            },
            {
                "Type": "bind",
                "Source": "/run/desktop/mnt/host/e/GSentinelHealthOS/broker/redis.conf",
                "Destination": "/usr/local/etc/redis/redis.conf",
                "Mode": "ro",
                "RW": false,
                "Propagation": "rprivate"
            }
        ],
        "Config": {
            "Hostname": "5baf6f677c1c",
            "Domainname": "",
            "User": "",
            "AttachStdin": false,
            "AttachStdout": true,
            "AttachStderr": true,
            "ExposedPorts": {
                "6379/tcp": {}
            },
            "Tty": false,
            "OpenStdin": false,
            "StdinOnce": false,
            "Env": [
                "REDIS_PASSWORD=bDAhxY9Af2LcR86iXN7U9gBIDpGeVuaiiKPLBTvEqLP2vbvy",
                "PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
                "REDIS_DOWNLOAD_URL=https://github.com/redis/redis/archive/refs/tags/8.0.2.tar.gz",
                "REDIS_DOWNLOAD_SHA=caf3c0069f06fc84c5153bd2a348b204c578de80490c73857bee01d9b5d7401f"
            ],
            "Cmd": [
                "sh",
                "-c",
                "redis-server /usr/local/etc/redis/redis.conf --replicaof redis-master 6379 --masterauth \"bDAhxY9Af2LcR86iXN7U9gBIDpGeVuaiiKPLBTvEqLP2vbvy\" --requirepass \"bDAhxY9Af2LcR86iXN7U9gBIDpGeVuaiiKPLBTvEqLP2vbvy\""
            ],
            "Healthcheck": {
                "Test": [
                    "CMD",
                    "sh",
                    "-c",
                    "redis-cli -h localhost -p 6379 -a \"$REDIS_PASSWORD\" ping"
                ],
                "Interval": 10000000000,
                "Timeout": 3000000000,
                "Retries": 5
            },
            "Image": "redis:8.0.2-alpine",
            "Volumes": {
                "/data": {}
            },
            "WorkingDir": "/data",
            "Entrypoint": [
                "docker-entrypoint.sh"
            ],
            "Labels": {
                "com.docker.compose.config-hash": "4ce09e18fc2c30cca057610182306de991411feb32c39c80e9ae5b2a4b847ddc",
                "com.docker.compose.container-number": "1",
                "com.docker.compose.depends_on": "redis-master:service_healthy:false",
                "com.docker.compose.image": "sha256:e74faa347ab0b6a3c1b040834a35ea5f20e3aa02460db4bb9d5b4685f3dd3baf",
                "com.docker.compose.oneoff": "False",
                "com.docker.compose.project": "gsentinelhealthos",
                "com.docker.compose.project.config_files": "E:\\GSentinelHealthOS\\docker-compose.yml",
                "com.docker.compose.project.working_dir": "E:\\GSentinelHealthOS",
                "com.docker.compose.replace": "gs_redis_replica",
                "com.docker.compose.service": "redis-replica",
                "com.docker.compose.version": "5.1.0"
            },
            "StopTimeout": 1
        },
        "NetworkSettings": {
            "SandboxID": "b0cfad1a334f5421775aa7ad0ae9f4ae5291feaffb778f7ea68cf76de78e7ac4",
            "SandboxKey": "/var/run/docker/netns/b0cfad1a334f",
            "Ports": {
                "6379/tcp": null
            },
            "Networks": {
                "gsentinelhealthos_gs_prod": {
                    "IPAMConfig": null,
                    "Links": null,
                    "Aliases": [
                        "gs_redis_replica",
                        "redis-replica"
                    ],
                    "DriverOpts": null,
                    "GwPriority": 0,
                    "NetworkID": "919bd5f232a0b0588e6ca20e3c563d7ca6731d36e1524f9f82fd1a1f698a1813",
                    "EndpointID": "c87a21f4b11b5ae3b02ce6f385b0cc65d05b206e176ff87afba3a7a23da2ba7f",
                    "Gateway": "172.20.0.1",
                    "IPAddress": "172.20.0.22",
                    "MacAddress": "4a:73:3c:c4:15:c5",
                    "IPPrefixLen": 16,
                    "IPv6Gateway": "",
                    "GlobalIPv6Address": "",
                    "GlobalIPv6PrefixLen": 0,
                    "DNSNames": [
                        "gs_redis_replica",
                        "redis-replica",
                        "5baf6f677c1c"
                    ]
                }
            }
        }
    },
    {
        "Id": "9e5e436bfa88cb79b3fae9b70a6292e5b761cb6fbec118d6871458a42416cdd9",
        "Created": "2026-05-17T20:50:47.539818035Z",
        "Path": "docker-entrypoint.sh",
        "Args": [
            "postgres",
            "-c",
            "max_connections=50",
            "-c",
            "shared_buffers=128MB"
        ],
        "State": {
            "Status": "running",
            "Running": true,
            "Paused": false,
            "Restarting": false,
            "OOMKilled": false,
            "Dead": false,
            "Pid": 1153,
            "ExitCode": 0,
            "Error": "",
            "StartedAt": "2026-05-18T21:45:20.049945348Z",
            "FinishedAt": "2026-05-18T21:45:16.194586622Z",
            "Health": {
                "Status": "healthy",
                "FailingStreak": 0,
                "Log": [
                    {
                        "Start": "2026-05-19T03:10:11.271522498Z",
                        "End": "2026-05-19T03:10:11.377444308Z",
                        "ExitCode": 0,
                        "Output": "/var/run/postgresql:5432 - accepting connections\n"
                    },
                    {
                        "Start": "2026-05-19T03:10:21.378331294Z",
                        "End": "2026-05-19T03:10:21.452190213Z",
                        "ExitCode": 0,
                        "Output": "/var/run/postgresql:5432 - accepting connections\n"
                    },
                    {
                        "Start": "2026-05-19T03:10:31.370535113Z",
                        "End": "2026-05-19T03:10:31.444594863Z",
                        "ExitCode": 0,
                        "Output": "/var/run/postgresql:5432 - accepting connections\n"
                    },
                    {
                        "Start": "2026-05-19T03:10:41.44604655Z",
                        "End": "2026-05-19T03:10:41.515456706Z",
                        "ExitCode": 0,
                        "Output": "/var/run/postgresql:5432 - accepting connections\n"
                    },
                    {
                        "Start": "2026-05-19T03:10:51.516661571Z",
                        "End": "2026-05-19T03:10:51.606247076Z",
                        "ExitCode": 0,
                        "Output": "/var/run/postgresql:5432 - accepting connections\n"
                    }
                ]
            }
        },
        "Image": "sha256:667495ca2ac33180ad3690178da1bf274f481d0c43849d4c1941f0176983bd2e",
        "ResolvConfPath": "/var/lib/docker/containers/9e5e436bfa88cb79b3fae9b70a6292e5b761cb6fbec118d6871458a42416cdd9/resolv.conf",
        "HostnamePath": "/var/lib/docker/containers/9e5e436bfa88cb79b3fae9b70a6292e5b761cb6fbec118d6871458a42416cdd9/hostname",
        "HostsPath": "/var/lib/docker/containers/9e5e436bfa88cb79b3fae9b70a6292e5b761cb6fbec118d6871458a42416cdd9/hosts",
        "LogPath": "/var/lib/docker/containers/9e5e436bfa88cb79b3fae9b70a6292e5b761cb6fbec118d6871458a42416cdd9/9e5e436bfa88cb79b3fae9b70a6292e5b761cb6fbec118d6871458a42416cdd9-json.log",
        "Name": "/gs_db",
        "RestartCount": 0,
        "Driver": "overlay2",
        "Platform": "linux",
        "MountLabel": "",
        "ProcessLabel": "",
        "AppArmorProfile": "",
        "ExecIDs": null,
        "HostConfig": {
            "Binds": [
                "E:\\GSentinelHealthOS\\database\\init-multiple-dbs.sql:/docker-entrypoINTERNAL_KEY_REDACTED.d/init.sql:ro",
                "gsentinelhealthos_postgres_data:/var/lib/postgresql/data:rw"
            ],
            "ContainerIDFile": "",
            "LogConfig": {
                "Type": "json-file",
                "Config": {
                    "max-file": "3",
                    "max-size": "10m"
                }
            },
            "NetworkMode": "gsentinelhealthos_gs_prod",
            "PortBindings": {
                "5432/tcp": [
                    {
                        "HostIp": "127.0.0.1",
                        "HostPort": "55433"
                    }
                ]
            },
            "RestartPolicy": {
                "Name": "unless-stopped",
                "MaximumRetryCount": 0
            },
            "AutoRemove": false,
            "VolumeDriver": "",
            "VolumesFrom": null,
            "ConsoleSize": [
                0,
                0
            ],
            "CapAdd": null,
            "CapDrop": null,
            "CgroupnsMode": "private",
            "Dns": [],
            "DnsOptions": [],
            "DnsSearch": [],
            "ExtraHosts": [],
            "GroupAdd": null,
            "IpcMode": "private",
            "Cgroup": "",
            "Links": null,
            "OomScoreAdj": 0,
            "PidMode": "",
            "Privileged": false,
            "PublishAllPorts": false,
            "ReadonlyRootfs": false,
            "SecurityOpt": [
                "no-new-privileges:true"
            ],
            "UTSMode": "",
            "UsernsMode": "",
            "ShmSize": 67108864,
            "Runtime": "runc",
            "Isolation": "",
            "CpuShares": 0,
            "Memory": 1073741824,
            "NanoCpus": 1000000000,
            "CgroupParent": "",
            "BlkioWeight": 0,
            "BlkioWeightDevice": null,
            "BlkioDeviceReadBps": null,
            "BlkioDeviceWriteBps": null,
            "BlkioDeviceReadIOps": null,
            "BlkioDeviceWriteIOps": null,
            "CpuPeriod": 0,
            "CpuQuota": 0,
            "CpuRealtimePeriod": 0,
            "CpuRealtimeRuntime": 0,
            "CpusetCpus": "",
            "CpusetMems": "",
            "Devices": null,
            "DeviceCgroupRules": null,
            "DeviceRequests": null,
            "MemoryReservation": 0,
            "MemorySwap": 2147483648,
            "MemorySwappiness": null,
            "OomKillDisable": null,
            "PidsLimit": null,
            "Ulimits": null,
            "CpuCount": 0,
            "CpuPercent": 0,
            "IOMaximumIOps": 0,
            "IOMaximumBandwidth": 0,
            "MaskedPaths": [
                "/proc/acpi",
                "/proc/asound",
                "/proc/interrupts",
                "/proc/kcore",
                "/proc/keys",
                "/proc/latency_stats",
                "/proc/sched_debug",
                "/proc/scsi",
                "/proc/timer_list",
                "/proc/timer_stats",
                "/sys/devices/virtual/powercap",
                "/sys/firmware"
            ],
            "ReadonlyPaths": [
                "/proc/bus",
                "/proc/fs",
                "/proc/irq",
                "/proc/sys",
                "/proc/sysrq-trigger"
            ]
        },
        "GraphDriver": {
            "Data": {
                "ID": "9e5e436bfa88cb79b3fae9b70a6292e5b761cb6fbec118d6871458a42416cdd9",
                "LowerDir": "/var/lib/docker/overlay2/1021f1fd3a849bad6747213e89ee432db42201f3ac14a1b9171be98ce993fe19-init/diff:/var/lib/docker/overlay2/bc638302940bc2b31c44f254cb1f8847cb1dcab36875d8209ae1893801b23218/diff:/var/lib/docker/overlay2/7d80e4df38e54fdf0f0d573ee467259b5ce71287c61724bb837f91e5ea95c0e4/diff:/var/lib/docker/overlay2/be70d6b3c3f5c69c11d09c088cfafecefb0c381ae00cd002cca5559464199789/diff:/var/lib/docker/overlay2/640943cfbbd5ed5e822879bfbfa4bf7cf569937fc4990d69188c4656fa7fb352/diff:/var/lib/docker/overlay2/bd40c3e761336c3f5fe74dc51833e841499d286099e0b6c198f8c3f1c5ba639d/diff:/var/lib/docker/overlay2/7f21f2e25a944eca126d0a9ebb84e840b69350987b1068e13f5afb9d2828789b/diff:/var/lib/docker/overlay2/7e24235bf59928fce68e55a63413dc3754e24422d14898d264a604674f8d007b/diff:/var/lib/docker/overlay2/2fc6f17c30bc9c688bd4cbde33f653f0697af0a50e64fbcdfebd540cfe4234fc/diff:/var/lib/docker/overlay2/07b6c08e075c4e729c8301d0f86961611125edac5c539afc60ab076f0ffabc7d/diff:/var/lib/docker/overlay2/23e7ad5261c3dc16f4eddc89d2a8445ae8880038bcdc68dd467921e82de7f3cf/diff:/var/lib/docker/overlay2/3bac9ff84ede15dcc656f87b12478c16f41ea1973b3274bd3e0b3fadc6522efb/diff",
                "MergedDir": "/var/lib/docker/overlay2/1021f1fd3a849bad6747213e89ee432db42201f3ac14a1b9171be98ce993fe19/merged",
                "UpperDir": "/var/lib/docker/overlay2/1021f1fd3a849bad6747213e89ee432db42201f3ac14a1b9171be98ce993fe19/diff",
                "WorkDir": "/var/lib/docker/overlay2/1021f1fd3a849bad6747213e89ee432db42201f3ac14a1b9171be98ce993fe19/work"
            },
            "Name": "overlay2"
        },
        "Mounts": [
            {
                "Type": "bind",
                "Source": "E:\\GSentinelHealthOS\\database\\init-multiple-dbs.sql",
                "Destination": "/docker-entrypoINTERNAL_KEY_REDACTED.d/init.sql",
                "Mode": "ro",
                "RW": false,
                "Propagation": "rprivate"
            },
            {
                "Type": "volume",
                "Name": "gsentinelhealthos_postgres_data",
                "Source": "/var/lib/docker/volumes/gsentinelhealthos_postgres_data/_data",
                "Destination": "/var/lib/postgresql/data",
                "Driver": "local",
                "Mode": "rw",
                "RW": true,
                "Propagation": ""
            }
        ],
        "Config": {
            "Hostname": "9e5e436bfa88",
            "Domainname": "",
            "User": "",
            "AttachStdin": false,
            "AttachStdout": true,
            "AttachStderr": true,
            "ExposedPorts": {
                "5432/tcp": {}
            },
            "Tty": false,
            "OpenStdin": false,
            "StdinOnce": false,
            "Env": [
                "POSTGRES_USER=sentinel",
                "POSTGRES_PASSWORD=OzMTDZYpxmFNivfGStWo0kB6Xb85Uweh",
                "POSTGRES_DB=gsentinel",
                "PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
                "GOSU_VERSION=1.19",
                "LANG=en_US.utf8",
                "PG_MAJOR=16",
                "PG_VERSION=16.13",
                "PG_SHA256=dc2ddbbd245c0265a689408e3d2f2f3f9ba2da96bd19318214b313cdd9797287",
                "DOCKER_PG_LLVM_DEPS=llvm19-dev \t\tclang19",
                "PGDATA=/var/lib/postgresql/data"
            ],
            "Cmd": [
                "postgres",
                "-c",
                "max_connections=50",
                "-c",
                "shared_buffers=128MB"
            ],
            "Healthcheck": {
                "Test": [
                    "CMD-SHELL",
                    "pg_isready -U sentinel -d gsentinel"
                ],
                "Interval": 10000000000,
                "Timeout": 5000000000,
                "Retries": 5
            },
            "Image": "postgres:16-alpine",
            "Volumes": {
                "/var/lib/postgresql/data": {}
            },
            "WorkingDir": "/",
            "Entrypoint": [
                "docker-entrypoint.sh"
            ],
            "Labels": {
                "com.docker.compose.config-hash": "13a33fe9a554dde4577444ac27dc824524ee8766519db195a686952cbefc2974",
                "com.docker.compose.container-number": "1",
                "com.docker.compose.depends_on": "",
                "com.docker.compose.image": "sha256:667495ca2ac33180ad3690178da1bf274f481d0c43849d4c1941f0176983bd2e",
                "com.docker.compose.oneoff": "False",
                "com.docker.compose.project": "gsentinelhealthos",
                "com.docker.compose.project.config_files": "E:\\GSentinelHealthOS\\docker-compose.yml",
                "com.docker.compose.project.working_dir": "E:\\GSentinelHealthOS",
                "com.docker.compose.replace": "gs_db",
                "com.docker.compose.service": "db",
                "com.docker.compose.version": "5.1.0"
            },
            "StopSignal": "SIGINT",
            "StopTimeout": 1
        },
        "NetworkSettings": {
            "SandboxID": "6c95f4926b9a22a24ab20a0242b5e201c8c80bb9443965f4c3d4d5738fe5401f",
            "SandboxKey": "/var/run/docker/netns/6c95f4926b9a",
            "Ports": {
                "5432/tcp": [
                    {
                        "HostIp": "127.0.0.1",
                        "HostPort": "55433"
                    }
                ]
            },
            "Networks": {
                "gsentinelhealthos_gs_prod": {
                    "IPAMConfig": null,
                    "Links": null,
                    "Aliases": [
                        "gs_db",
                        "db"
                    ],
                    "DriverOpts": null,
                    "GwPriority": 0,
                    "NetworkID": "919bd5f232a0b0588e6ca20e3c563d7ca6731d36e1524f9f82fd1a1f698a1813",
                    "EndpointID": "02c8fc123e2e5b075c88720d8c9118ffbe474c48cba6d9064d61f4055ae76c58",
                    "Gateway": "172.20.0.1",
                    "IPAddress": "172.20.0.17",
                    "MacAddress": "5a:f2:bb:d1:f7:16",
                    "IPPrefixLen": 16,
                    "IPv6Gateway": "",
                    "GlobalIPv6Address": "",
                    "GlobalIPv6PrefixLen": 0,
                    "DNSNames": [
                        "gs_db",
                        "db",
                        "9e5e436bfa88"
                    ]
                }
            }
        }
    },
    {
        "Id": "066b19b443ee3d3df01523237778c75c785321bb47efebb7203337e2bf2d9bee",
        "Created": "2026-05-17T20:50:47.527659643Z",
        "Path": "docker-entrypoint.sh",
        "Args": [
            "sh",
            "-c",
            "redis-server /usr/local/etc/redis/redis.conf --requirepass \"bDAhxY9Af2LcR86iXN7U9gBIDpGeVuaiiKPLBTvEqLP2vbvy\""
        ],
        "State": {
            "Status": "running",
            "Running": true,
            "Paused": false,
            "Restarting": false,
            "OOMKilled": false,
            "Dead": false,
            "Pid": 1080,
            "ExitCode": 0,
            "Error": "",
            "StartedAt": "2026-05-18T21:45:19.94833302Z",
            "FinishedAt": "2026-05-18T21:45:16.193978967Z",
            "Health": {
                "Status": "healthy",
                "FailingStreak": 0,
                "Log": [
                    {
                        "Start": "2026-05-19T03:10:11.209887883Z",
                        "End": "2026-05-19T03:10:11.306069908Z",
                        "ExitCode": 0,
                        "Output": "Warning: Using a password with '-a' or '-u' option on the command line interface may not be safe.\nPONG\n"
                    },
                    {
                        "Start": "2026-05-19T03:10:21.307305798Z",
                        "End": "2026-05-19T03:10:21.381006481Z",
                        "ExitCode": 0,
                        "Output": "Warning: Using a password with '-a' or '-u' option on the command line interface may not be safe.\nPONG\n"
                    },
                    {
                        "Start": "2026-05-19T03:10:31.300020512Z",
                        "End": "2026-05-19T03:10:31.368321854Z",
                        "ExitCode": 0,
                        "Output": "Warning: Using a password with '-a' or '-u' option on the command line interface may not be safe.\nPONG\n"
                    },
                    {
                        "Start": "2026-05-19T03:10:41.369568988Z",
                        "End": "2026-05-19T03:10:41.446299999Z",
                        "ExitCode": 0,
                        "Output": "Warning: Using a password with '-a' or '-u' option on the command line interface may not be safe.\nPONG\n"
                    },
                    {
                        "Start": "2026-05-19T03:10:51.447011382Z",
                        "End": "2026-05-19T03:10:51.546829259Z",
                        "ExitCode": 0,
                        "Output": "Warning: Using a password with '-a' or '-u' option on the command line interface may not be safe.\nPONG\n"
                    }
                ]
            }
        },
        "Image": "sha256:e74faa347ab0b6a3c1b040834a35ea5f20e3aa02460db4bb9d5b4685f3dd3baf",
        "ResolvConfPath": "/var/lib/docker/containers/066b19b443ee3d3df01523237778c75c785321bb47efebb7203337e2bf2d9bee/resolv.conf",
        "HostnamePath": "/var/lib/docker/containers/066b19b443ee3d3df01523237778c75c785321bb47efebb7203337e2bf2d9bee/hostname",
        "HostsPath": "/var/lib/docker/containers/066b19b443ee3d3df01523237778c75c785321bb47efebb7203337e2bf2d9bee/hosts",
        "LogPath": "/var/lib/docker/containers/066b19b443ee3d3df01523237778c75c785321bb47efebb7203337e2bf2d9bee/066b19b443ee3d3df01523237778c75c785321bb47efebb7203337e2bf2d9bee-json.log",
        "Name": "/gs_redis_master",
        "RestartCount": 0,
        "Driver": "overlay2",
        "Platform": "linux",
        "MountLabel": "",
        "ProcessLabel": "",
        "AppArmorProfile": "",
        "ExecIDs": null,
        "HostConfig": {
            "Binds": [
                "gsentinelhealthos_redis_master_data:/data:rw",
                "/run/desktop/mnt/host/e/GSentinelHealthOS/broker/redis.conf:/usr/local/etc/redis/redis.conf:ro"
            ],
            "ContainerIDFile": "",
            "LogConfig": {
                "Type": "json-file",
                "Config": {
                    "max-file": "3",
                    "max-size": "10m"
                }
            },
            "NetworkMode": "gsentinelhealthos_gs_prod",
            "PortBindings": {},
            "RestartPolicy": {
                "Name": "unless-stopped",
                "MaximumRetryCount": 0
            },
            "AutoRemove": false,
            "VolumeDriver": "",
            "VolumesFrom": null,
            "ConsoleSize": [
                0,
                0
            ],
            "CapAdd": null,
            "CapDrop": null,
            "CgroupnsMode": "private",
            "Dns": [],
            "DnsOptions": [],
            "DnsSearch": [],
            "ExtraHosts": [],
            "GroupAdd": null,
            "IpcMode": "private",
            "Cgroup": "",
            "Links": null,
            "OomScoreAdj": 0,
            "PidMode": "",
            "Privileged": false,
            "PublishAllPorts": false,
            "ReadonlyRootfs": false,
            "SecurityOpt": [
                "no-new-privileges:true"
            ],
            "UTSMode": "",
            "UsernsMode": "",
            "ShmSize": 67108864,
            "Runtime": "runc",
            "Isolation": "",
            "CpuShares": 0,
            "Memory": 805306368,
            "NanoCpus": 750000000,
            "CgroupParent": "",
            "BlkioWeight": 0,
            "BlkioWeightDevice": null,
            "BlkioDeviceReadBps": null,
            "BlkioDeviceWriteBps": null,
            "BlkioDeviceReadIOps": null,
            "BlkioDeviceWriteIOps": null,
            "CpuPeriod": 0,
            "CpuQuota": 0,
            "CpuRealtimePeriod": 0,
            "CpuRealtimeRuntime": 0,
            "CpusetCpus": "",
            "CpusetMems": "",
            "Devices": null,
            "DeviceCgroupRules": null,
            "DeviceRequests": null,
            "MemoryReservation": 0,
            "MemorySwap": 1610612736,
            "MemorySwappiness": null,
            "OomKillDisable": null,
            "PidsLimit": null,
            "Ulimits": null,
            "CpuCount": 0,
            "CpuPercent": 0,
            "IOMaximumIOps": 0,
            "IOMaximumBandwidth": 0,
            "MaskedPaths": [
                "/proc/acpi",
                "/proc/asound",
                "/proc/interrupts",
                "/proc/kcore",
                "/proc/keys",
                "/proc/latency_stats",
                "/proc/sched_debug",
                "/proc/scsi",
                "/proc/timer_list",
                "/proc/timer_stats",
                "/sys/devices/virtual/powercap",
                "/sys/firmware"
            ],
            "ReadonlyPaths": [
                "/proc/bus",
                "/proc/fs",
                "/proc/irq",
                "/proc/sys",
                "/proc/sysrq-trigger"
            ]
        },
        "GraphDriver": {
            "Data": {
                "ID": "066b19b443ee3d3df01523237778c75c785321bb47efebb7203337e2bf2d9bee",
                "LowerDir": "/var/lib/docker/overlay2/65f6f9862a5f1338dc06e87d3a4b02225d45ccde9aaacc8b3a6e7901b4899b09-init/diff:/var/lib/docker/overlay2/8c9090380150b4636f6319b5c2b8adc07efaca5df68e948e6418fd36c142f49d/diff:/var/lib/docker/overlay2/e85f396d82ffc5d990826d062fe059185779692ff70111fe596efb62c2876923/diff:/var/lib/docker/overlay2/8cca02262c9f2436236c122d7e63eba78ab4be5b77971c372934efcb7bf5bdf1/diff:/var/lib/docker/overlay2/7267c3d380a80502ea27c1cf22254c597730fa6f0bf94e8b9fcb6dd189c771a1/diff:/var/lib/docker/overlay2/6de7058bf8829c0201fb6b07e6f1b2b08c8be1068e686abc36ee6a8175fd320f/diff:/var/lib/docker/overlay2/4f0da3802045cf986cc9b74d1eeb229e70ab60670cef9f9fbd9b6a77ae4c0ea2/diff:/var/lib/docker/overlay2/fccffb1cd9ddd708bbb163c23a68583fc17fda15258ccaf798f28f97bbe2319d/diff",
                "MergedDir": "/var/lib/docker/overlay2/65f6f9862a5f1338dc06e87d3a4b02225d45ccde9aaacc8b3a6e7901b4899b09/merged",
                "UpperDir": "/var/lib/docker/overlay2/65f6f9862a5f1338dc06e87d3a4b02225d45ccde9aaacc8b3a6e7901b4899b09/diff",
                "WorkDir": "/var/lib/docker/overlay2/65f6f9862a5f1338dc06e87d3a4b02225d45ccde9aaacc8b3a6e7901b4899b09/work"
            },
            "Name": "overlay2"
        },
        "Mounts": [
            {
                "Type": "volume",
                "Name": "gsentinelhealthos_redis_master_data",
                "Source": "/var/lib/docker/volumes/gsentinelhealthos_redis_master_data/_data",
                "Destination": "/data",
                "Driver": "local",
                "Mode": "rw",
                "RW": true,
                "Propagation": ""
            },
            {
                "Type": "bind",
                "Source": "/run/desktop/mnt/host/e/GSentinelHealthOS/broker/redis.conf",
                "Destination": "/usr/local/etc/redis/redis.conf",
                "Mode": "ro",
                "RW": false,
                "Propagation": "rprivate"
            }
        ],
        "Config": {
            "Hostname": "066b19b443ee",
            "Domainname": "",
            "User": "",
            "AttachStdin": false,
            "AttachStdout": true,
            "AttachStderr": true,
            "ExposedPorts": {
                "6379/tcp": {}
            },
            "Tty": false,
            "OpenStdin": false,
            "StdinOnce": false,
            "Env": [
                "REDIS_PASSWORD=bDAhxY9Af2LcR86iXN7U9gBIDpGeVuaiiKPLBTvEqLP2vbvy",
                "PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
                "REDIS_DOWNLOAD_URL=https://github.com/redis/redis/archive/refs/tags/8.0.2.tar.gz",
                "REDIS_DOWNLOAD_SHA=caf3c0069f06fc84c5153bd2a348b204c578de80490c73857bee01d9b5d7401f"
            ],
            "Cmd": [
                "sh",
                "-c",
                "redis-server /usr/local/etc/redis/redis.conf --requirepass \"bDAhxY9Af2LcR86iXN7U9gBIDpGeVuaiiKPLBTvEqLP2vbvy\""
            ],
            "Healthcheck": {
                "Test": [
                    "CMD",
                    "sh",
                    "-c",
                    "redis-cli -h localhost -p 6379 -a \"$REDIS_PASSWORD\" ping"
                ],
                "Interval": 10000000000,
                "Timeout": 3000000000,
                "Retries": 5
            },
            "Image": "redis:8.0.2-alpine",
            "Volumes": {
                "/data": {}
            },
            "WorkingDir": "/data",
            "Entrypoint": [
                "docker-entrypoint.sh"
            ],
            "Labels": {
                "com.docker.compose.config-hash": "0afad0ea5d70025c1bacf5246b25490a12f16cb385cdc8be7f02ae66dc353e67",
                "com.docker.compose.container-number": "1",
                "com.docker.compose.depends_on": "",
                "com.docker.compose.image": "sha256:e74faa347ab0b6a3c1b040834a35ea5f20e3aa02460db4bb9d5b4685f3dd3baf",
                "com.docker.compose.oneoff": "False",
                "com.docker.compose.project": "gsentinelhealthos",
                "com.docker.compose.project.config_files": "E:\\GSentinelHealthOS\\docker-compose.yml",
                "com.docker.compose.project.working_dir": "E:\\GSentinelHealthOS",
                "com.docker.compose.replace": "gs_redis_master",
                "com.docker.compose.service": "redis-master",
                "com.docker.compose.version": "5.1.0"
            },
            "StopTimeout": 1
        },
        "NetworkSettings": {
            "SandboxID": "26184262b0b878eefc6b6ee034e1e10b119c7e906b02dec8cf14a1e52deb8fc1",
            "SandboxKey": "/var/run/docker/netns/26184262b0b8",
            "Ports": {
                "6379/tcp": null
            },
            "Networks": {
                "gsentinelhealthos_gs_prod": {
                    "IPAMConfig": null,
                    "Links": null,
                    "Aliases": [
                        "gs_redis_master",
                        "redis-master"
                    ],
                    "DriverOpts": null,
                    "GwPriority": 0,
                    "NetworkID": "919bd5f232a0b0588e6ca20e3c563d7ca6731d36e1524f9f82fd1a1f698a1813",
                    "EndpointID": "4bd3915f6531878863bc176a5300c276c8b14daa225229b2e2568f43342bb4d3",
                    "Gateway": "172.20.0.1",
                    "IPAddress": "172.20.0.6",
                    "MacAddress": "06:00:23:22:d2:58",
                    "IPPrefixLen": 16,
                    "IPv6Gateway": "",
                    "GlobalIPv6Address": "",
                    "GlobalIPv6PrefixLen": 0,
                    "DNSNames": [
                        "gs_redis_master",
                        "redis-master",
                        "066b19b443ee"
                    ]
                }
            }
        }
    },
    {
        "Id": "708fd509b9022725cc6ae185e8db9b25c54ac20fd251e92e8902270c9ba3658f",
        "Created": "2026-05-17T18:01:35.918918948Z",
        "Path": "docker-entrypoint.sh",
        "Args": [
            "node",
            "server.js"
        ],
        "State": {
            "Status": "running",
            "Running": true,
            "Paused": false,
            "Restarting": false,
            "OOMKilled": false,
            "Dead": false,
            "Pid": 1094,
            "ExitCode": 0,
            "Error": "",
            "StartedAt": "2026-05-18T21:45:19.914483018Z",
            "FinishedAt": "2026-05-18T21:45:16.195042143Z",
            "Health": {
                "Status": "healthy",
                "FailingStreak": 0,
                "Log": [
                    {
                        "Start": "2026-05-19T03:08:26.584634862Z",
                        "End": "2026-05-19T03:08:27.163750167Z",
                        "ExitCode": 0,
                        "Output": ""
                    },
                    {
                        "Start": "2026-05-19T03:08:57.081223465Z",
                        "End": "2026-05-19T03:08:57.759890617Z",
                        "ExitCode": 0,
                        "Output": ""
                    },
                    {
                        "Start": "2026-05-19T03:09:27.670489289Z",
                        "End": "2026-05-19T03:09:28.196049632Z",
                        "ExitCode": 0,
                        "Output": ""
                    },
                    {
                        "Start": "2026-05-19T03:09:58.111880382Z",
                        "End": "2026-05-19T03:09:58.668702071Z",
                        "ExitCode": 0,
                        "Output": ""
                    },
                    {
                        "Start": "2026-05-19T03:10:28.587935211Z",
                        "End": "2026-05-19T03:10:29.107865025Z",
                        "ExitCode": 0,
                        "Output": ""
                    }
                ]
            }
        },
        "Image": "sha256:2171c0abf440c549a5cde95cf903bf2acdf6ba484e94cebc55458aa39fd19951",
        "ResolvConfPath": "/var/lib/docker/containers/708fd509b9022725cc6ae185e8db9b25c54ac20fd251e92e8902270c9ba3658f/resolv.conf",
        "HostnamePath": "/var/lib/docker/containers/708fd509b9022725cc6ae185e8db9b25c54ac20fd251e92e8902270c9ba3658f/hostname",
        "HostsPath": "/var/lib/docker/containers/708fd509b9022725cc6ae185e8db9b25c54ac20fd251e92e8902270c9ba3658f/hosts",
        "LogPath": "/var/lib/docker/containers/708fd509b9022725cc6ae185e8db9b25c54ac20fd251e92e8902270c9ba3658f/708fd509b9022725cc6ae185e8db9b25c54ac20fd251e92e8902270c9ba3658f-json.log",
        "Name": "/gs_panel_admin",
        "RestartCount": 0,
        "Driver": "overlay2",
        "Platform": "linux",
        "MountLabel": "",
        "ProcessLabel": "",
        "AppArmorProfile": "",
        "ExecIDs": null,
        "HostConfig": {
            "Binds": [
                "gsentinelhealthos_panel_admin_runtime:/app/.runtime:rw"
            ],
            "ContainerIDFile": "",
            "LogConfig": {
                "Type": "json-file",
                "Config": {
                    "max-file": "3",
                    "max-size": "5m"
                }
            },
            "NetworkMode": "gsentinelhealthos_gs_prod",
            "PortBindings": {
                "3010/tcp": [
                    {
                        "HostIp": "127.0.0.1",
                        "HostPort": "3010"
                    }
                ]
            },
            "RestartPolicy": {
                "Name": "unless-stopped",
                "MaximumRetryCount": 0
            },
            "AutoRemove": false,
            "VolumeDriver": "",
            "VolumesFrom": null,
            "ConsoleSize": [
                0,
                0
            ],
            "CapAdd": null,
            "CapDrop": null,
            "CgroupnsMode": "private",
            "Dns": [],
            "DnsOptions": [],
            "DnsSearch": [],
            "ExtraHosts": [],
            "GroupAdd": null,
            "IpcMode": "private",
            "Cgroup": "",
            "Links": null,
            "OomScoreAdj": 0,
            "PidMode": "",
            "Privileged": false,
            "PublishAllPorts": false,
            "ReadonlyRootfs": false,
            "SecurityOpt": [
                "no-new-privileges:true"
            ],
            "UTSMode": "",
            "UsernsMode": "",
            "ShmSize": 67108864,
            "Runtime": "runc",
            "Isolation": "",
            "CpuShares": 0,
            "Memory": 268435456,
            "NanoCpus": 500000000,
            "CgroupParent": "",
            "BlkioWeight": 0,
            "BlkioWeightDevice": null,
            "BlkioDeviceReadBps": null,
            "BlkioDeviceWriteBps": null,
            "BlkioDeviceReadIOps": null,
            "BlkioDeviceWriteIOps": null,
            "CpuPeriod": 0,
            "CpuQuota": 0,
            "CpuRealtimePeriod": 0,
            "CpuRealtimeRuntime": 0,
            "CpusetCpus": "",
            "CpusetMems": "",
            "Devices": null,
            "DeviceCgroupRules": null,
            "DeviceRequests": null,
            "MemoryReservation": 0,
            "MemorySwap": 536870912,
            "MemorySwappiness": null,
            "OomKillDisable": null,
            "PidsLimit": null,
            "Ulimits": null,
            "CpuCount": 0,
            "CpuPercent": 0,
            "IOMaximumIOps": 0,
            "IOMaximumBandwidth": 0,
            "MaskedPaths": [
                "/proc/acpi",
                "/proc/asound",
                "/proc/interrupts",
                "/proc/kcore",
                "/proc/keys",
                "/proc/latency_stats",
                "/proc/sched_debug",
                "/proc/scsi",
                "/proc/timer_list",
                "/proc/timer_stats",
                "/sys/devices/virtual/powercap",
                "/sys/firmware"
            ],
            "ReadonlyPaths": [
                "/proc/bus",
                "/proc/fs",
                "/proc/irq",
                "/proc/sys",
                "/proc/sysrq-trigger"
            ]
        },
        "GraphDriver": {
            "Data": {
                "ID": "708fd509b9022725cc6ae185e8db9b25c54ac20fd251e92e8902270c9ba3658f",
                "LowerDir": "/var/lib/docker/overlay2/97dfe2f0503c1c0f4de75328b3f47d97c1fe6084c45c6f61e11dc5538c7bf432-init/diff:/var/lib/docker/overlay2/l7fz7zdw2atcv5j8ilymzfq6o/diff:/var/lib/docker/overlay2/80ebjeqlduj670v42m2vfi1uq/diff:/var/lib/docker/overlay2/zia78xx17haqhstg8rypsexwy/diff:/var/lib/docker/overlay2/eeymqqvi937wz93f7jdckn9k2/diff:/var/lib/docker/overlay2/rtw3svkajrg7qivioqbtumo2q/diff:/var/lib/docker/overlay2/b2e0dbcb5184fdb6068a41941252bde0fecfd4527f5d320136de4d5790e928df/diff:/var/lib/docker/overlay2/f90ac297d21f94f3a6ad3abe718406b61c817172be0fe3494cbbaed63316ae2a/diff:/var/lib/docker/overlay2/61858e61be63bd0a37c085d263d78e37d7cb89a50ba7b1423f9a385bf8634352/diff:/var/lib/docker/overlay2/3bac9ff84ede15dcc656f87b12478c16f41ea1973b3274bd3e0b3fadc6522efb/diff",
                "MergedDir": "/var/lib/docker/overlay2/97dfe2f0503c1c0f4de75328b3f47d97c1fe6084c45c6f61e11dc5538c7bf432/merged",
                "UpperDir": "/var/lib/docker/overlay2/97dfe2f0503c1c0f4de75328b3f47d97c1fe6084c45c6f61e11dc5538c7bf432/diff",
                "WorkDir": "/var/lib/docker/overlay2/97dfe2f0503c1c0f4de75328b3f47d97c1fe6084c45c6f61e11dc5538c7bf432/work"
            },
            "Name": "overlay2"
        },
        "Mounts": [
            {
                "Type": "volume",
                "Name": "gsentinelhealthos_panel_admin_runtime",
                "Source": "/var/lib/docker/volumes/gsentinelhealthos_panel_admin_runtime/_data",
                "Destination": "/app/.runtime",
                "Driver": "local",
                "Mode": "rw",
                "RW": true,
                "Propagation": ""
            }
        ],
        "Config": {
            "Hostname": "708fd509b902",
            "Domainname": "",
            "User": "nextjs",
            "AttachStdin": false,
            "AttachStdout": true,
            "AttachStderr": true,
            "ExposedPorts": {
                "3010/tcp": {}
            },
            "Tty": false,
            "OpenStdin": false,
            "StdinOnce": false,
            "Env": [
                "SUPER_ADMIN_PASSWORD_HASH=$2a$12$NhgAJwfJiqQlQg6UExe4zu3yy3b5J3auknbnaYd5pbmsN.BVuu6K.",
                "BRAIN_INTERNAL_URL=http://brain:8001",
                "SUPER_ADMIN_EMAIL=soporte@gsentinelhealth.com.ar",
                "MBWHATSAPP_INTERNAL_URL=http://frontend:3000",
                "SUPER_ADMIN_COOKIE_SECURE=false",
                "MEDICAL_AGENDA_CREATE_CLINIC_URL=http://frontend:3000/api/internal/client-onboarding",
                "NODE_ENV=production",
                "MBCHAT_INTERNAL_URL=http://frontend:3000",
                "SUPER_ADMIN_JWT_SECRET=sa_jwt_9qK2mV8cR4xL7nP1zT6dF3hB0wS5yU",
                "AGENDA_API_INTERNAL_URL=http://api:8000",
                "NEXT_TELEMETRY_DISABLED=1",
                "ADMIN_API_INTERNAL_KEY=PANEL_ADMIN_KEY_REDACTED",
                "MBSECRETARIA_INTERNAL_URL=http://frontend:3000",
                "NEXT_PUBLIC_APP_VERSION=0.2.0",
                "HEALTH_CHECK_TIMEOUT_MS=5000",
                "PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
                "NODE_VERSION=20.20.2",
                "YARN_VERSION=1.22.22",
                "PORT=3010",
                "HOSTNAME=0.0.0.0"
            ],
            "Cmd": [
                "node",
                "server.js"
            ],
            "Healthcheck": {
                "Test": [
                    "CMD-SHELL",
                    "node -e \"fetch('http://localhost:3010/api/auth/me').then(()=\u003eprocess.exit(0)).catch(()=\u003eprocess.exit(0))\""
                ],
                "Interval": 30000000000,
                "Timeout": 10000000000,
                "Retries": 3
            },
            "Image": "gsentinelhealthos-panel-admin",
            "Volumes": null,
            "WorkingDir": "/app",
            "Entrypoint": [
                "docker-entrypoint.sh"
            ],
            "Labels": {
                "com.docker.compose.config-hash": "360cf81c202542977b228044df42426d703d1ade19323aeb3ac0ddade29b78e0",
                "com.docker.compose.container-number": "1",
                "com.docker.compose.depends_on": "api:service_healthy:false",
                "com.docker.compose.image": "sha256:2171c0abf440c549a5cde95cf903bf2acdf6ba484e94cebc55458aa39fd19951",
                "com.docker.compose.oneoff": "False",
                "com.docker.compose.project": "gsentinelhealthos",
                "com.docker.compose.project.config_files": "e:\\GSentinelHealthOS\\docker-compose.yml",
                "com.docker.compose.project.working_dir": "e:\\GSentinelHealthOS",
                "com.docker.compose.replace": "gs_panel_admin",
                "com.docker.compose.service": "panel-admin",
                "com.docker.compose.version": "5.1.0"
            },
            "StopTimeout": 1
        },
        "NetworkSettings": {
            "SandboxID": "d9c8e5830ac4b1ceea1cddd582ec777f02cfe1ab1bf54a7b79101b53455ea617",
            "SandboxKey": "/var/run/docker/netns/d9c8e5830ac4",
            "Ports": {
                "3010/tcp": []
            },
            "Networks": {
                "gsentinelhealthos_gs_prod": {
                    "IPAMConfig": null,
                    "Links": null,
                    "Aliases": [
                        "gs_panel_admin",
                        "panel-admin"
                    ],
                    "DriverOpts": null,
                    "GwPriority": 0,
                    "NetworkID": "919bd5f232a0b0588e6ca20e3c563d7ca6731d36e1524f9f82fd1a1f698a1813",
                    "EndpointID": "ff38d69b15bb04c0fee3fc9a19a110e1354c413c0757ed6e6bfca9932722e7ba",
                    "Gateway": "172.20.0.1",
                    "IPAddress": "172.20.0.2",
                    "MacAddress": "e6:73:78:50:23:51",
                    "IPPrefixLen": 16,
                    "IPv6Gateway": "",
                    "GlobalIPv6Address": "",
                    "GlobalIPv6PrefixLen": 0,
                    "DNSNames": [
                        "gs_panel_admin",
                        "panel-admin",
                        "708fd509b902"
                    ]
                }
            }
        }
    },
    {
        "Id": "3df091884d4a52fd85372b21a4bb07002c638c44928eb9000c11e17575b59183",
        "Created": "2026-05-16T21:19:49.351921232Z",
        "Path": "/run.sh",
        "Args": [],
        "State": {
            "Status": "running",
            "Running": true,
            "Paused": false,
            "Restarting": false,
            "OOMKilled": false,
            "Dead": false,
            "Pid": 1484,
            "ExitCode": 0,
            "Error": "",
            "StartedAt": "2026-05-18T21:45:20.106352324Z",
            "FinishedAt": "2026-05-18T21:45:16.195089664Z",
            "Health": {
                "Status": "healthy",
                "FailingStreak": 0,
                "Log": [
                    {
                        "Start": "2026-05-19T03:09:51.661654758Z",
                        "End": "2026-05-19T03:09:51.718982121Z",
                        "ExitCode": 0,
                        "Output": "Connecting to localhost:3000 ([::1]:3000)\nremote file exists\n"
                    },
                    {
                        "Start": "2026-05-19T03:10:06.635193097Z",
                        "End": "2026-05-19T03:10:06.69795083Z",
                        "ExitCode": 0,
                        "Output": "Connecting to localhost:3000 ([::1]:3000)\nremote file exists\n"
                    },
                    {
                        "Start": "2026-05-19T03:10:21.699521051Z",
                        "End": "2026-05-19T03:10:21.751478528Z",
                        "ExitCode": 0,
                        "Output": "Connecting to localhost:3000 ([::1]:3000)\nremote file exists\n"
                    },
                    {
                        "Start": "2026-05-19T03:10:36.669876439Z",
                        "End": "2026-05-19T03:10:36.76408581Z",
                        "ExitCode": 0,
                        "Output": "Connecting to localhost:3000 ([::1]:3000)\nremote file exists\n"
                    },
                    {
                        "Start": "2026-05-19T03:10:51.764711473Z",
                        "End": "2026-05-19T03:10:51.833054429Z",
                        "ExitCode": 0,
                        "Output": "Connecting to localhost:3000 ([::1]:3000)\nremote file exists\n"
                    }
                ]
            }
        },
        "Image": "sha256:679e4be9f9184b60905bc3c9297d293d0070f1d1155017877cf0199b1f1b787c",
        "ResolvConfPath": "/var/lib/docker/containers/3df091884d4a52fd85372b21a4bb07002c638c44928eb9000c11e17575b59183/resolv.conf",
        "HostnamePath": "/var/lib/docker/containers/3df091884d4a52fd85372b21a4bb07002c638c44928eb9000c11e17575b59183/hostname",
        "HostsPath": "/var/lib/docker/containers/3df091884d4a52fd85372b21a4bb07002c638c44928eb9000c11e17575b59183/hosts",
        "LogPath": "/var/lib/docker/containers/3df091884d4a52fd85372b21a4bb07002c638c44928eb9000c11e17575b59183/3df091884d4a52fd85372b21a4bb07002c638c44928eb9000c11e17575b59183-json.log",
        "Name": "/gs_grafana",
        "RestartCount": 0,
        "Driver": "overlay2",
        "Platform": "linux",
        "MountLabel": "",
        "ProcessLabel": "",
        "AppArmorProfile": "",
        "ExecIDs": null,
        "HostConfig": {
            "Binds": [
                "gsentinelhealthos_grafana_data:/var/lib/grafana:rw",
                "/run/desktop/mnt/host/e/GSentinelHealthOS/observability/grafana/provisioning:/etc/grafana/provisioning:ro"
            ],
            "ContainerIDFile": "",
            "LogConfig": {
                "Type": "json-file",
                "Config": {
                    "max-file": "3",
                    "max-size": "10m"
                }
            },
            "NetworkMode": "gsentinelhealthos_gs_prod",
            "PortBindings": {
                "3000/tcp": [
                    {
                        "HostIp": "127.0.0.1",
                        "HostPort": "3020"
                    }
                ]
            },
            "RestartPolicy": {
                "Name": "unless-stopped",
                "MaximumRetryCount": 0
            },
            "AutoRemove": false,
            "VolumeDriver": "",
            "VolumesFrom": null,
            "ConsoleSize": [
                0,
                0
            ],
            "CapAdd": null,
            "CapDrop": null,
            "CgroupnsMode": "private",
            "Dns": [],
            "DnsOptions": [],
            "DnsSearch": [],
            "ExtraHosts": [],
            "GroupAdd": null,
            "IpcMode": "private",
            "Cgroup": "",
            "Links": null,
            "OomScoreAdj": 0,
            "PidMode": "",
            "Privileged": false,
            "PublishAllPorts": false,
            "ReadonlyRootfs": false,
            "SecurityOpt": [
                "no-new-privileges:true"
            ],
            "UTSMode": "",
            "UsernsMode": "",
            "ShmSize": 67108864,
            "Runtime": "runc",
            "Isolation": "",
            "CpuShares": 0,
            "Memory": 268435456,
            "NanoCpus": 500000000,
            "CgroupParent": "",
            "BlkioWeight": 0,
            "BlkioWeightDevice": null,
            "BlkioDeviceReadBps": null,
            "BlkioDeviceWriteBps": null,
            "BlkioDeviceReadIOps": null,
            "BlkioDeviceWriteIOps": null,
            "CpuPeriod": 0,
            "CpuQuota": 0,
            "CpuRealtimePeriod": 0,
            "CpuRealtimeRuntime": 0,
            "CpusetCpus": "",
            "CpusetMems": "",
            "Devices": null,
            "DeviceCgroupRules": null,
            "DeviceRequests": null,
            "MemoryReservation": 0,
            "MemorySwap": 536870912,
            "MemorySwappiness": null,
            "OomKillDisable": null,
            "PidsLimit": null,
            "Ulimits": null,
            "CpuCount": 0,
            "CpuPercent": 0,
            "IOMaximumIOps": 0,
            "IOMaximumBandwidth": 0,
            "MaskedPaths": [
                "/proc/acpi",
                "/proc/asound",
                "/proc/interrupts",
                "/proc/kcore",
                "/proc/keys",
                "/proc/latency_stats",
                "/proc/sched_debug",
                "/proc/scsi",
                "/proc/timer_list",
                "/proc/timer_stats",
                "/sys/devices/virtual/powercap",
                "/sys/firmware"
            ],
            "ReadonlyPaths": [
                "/proc/bus",
                "/proc/fs",
                "/proc/irq",
                "/proc/sys",
                "/proc/sysrq-trigger"
            ]
        },
        "GraphDriver": {
            "Data": {
                "ID": "3df091884d4a52fd85372b21a4bb07002c638c44928eb9000c11e17575b59183",
                "LowerDir": "/var/lib/docker/overlay2/b72e27d40b988b76b896d75e5e1211b8777c9a173fd9468744bcae1edfc57354-init/diff:/var/lib/docker/overlay2/44ef433ab54cd63e552dd7539bf68cfb6fd4732a78a65e026df0234bd74e54df/diff:/var/lib/docker/overlay2/5af90573315a2f11eddf4c5c1993e8f638d004b7167d2f20d268a10a6f391c4e/diff:/var/lib/docker/overlay2/e715a33d3117d87ff6a222b9452873519d01fea10a261a1419864571c4bef139/diff:/var/lib/docker/overlay2/7af45770ccec4e191ace114319ef9dd42d1672c6de2660a5df142d3a974f43d7/diff:/var/lib/docker/overlay2/04dd970c89fdba950238770791cdf82e412d2697fbe0c8fb3ce94027474ed948/diff:/var/lib/docker/overlay2/e1ee6c2f8339f6a4fdbdcbe45b6b10fe94944e7a29a8c8defd11c002e20bd5fb/diff:/var/lib/docker/overlay2/65c679adc734466f1def875fa43f5399709cfe74c5f8e94ace7c93acbfa0c240/diff:/var/lib/docker/overlay2/efd3659f0ac5eda37b7c7db4f0f5af5cddce6dd7f3b43760480dc71a7341d800/diff:/var/lib/docker/overlay2/d1534fac4ad10ac94b29a829ba9f07295283b5f37c363ce6db1066c572f9a53f/diff:/var/lib/docker/overlay2/a4b831fa510a65f2dbb0224443426c576a6c6315b4e6c4b04760bf8843a1a17a/diff",
                "MergedDir": "/var/lib/docker/overlay2/b72e27d40b988b76b896d75e5e1211b8777c9a173fd9468744bcae1edfc57354/merged",
                "UpperDir": "/var/lib/docker/overlay2/b72e27d40b988b76b896d75e5e1211b8777c9a173fd9468744bcae1edfc57354/diff",
                "WorkDir": "/var/lib/docker/overlay2/b72e27d40b988b76b896d75e5e1211b8777c9a173fd9468744bcae1edfc57354/work"
            },
            "Name": "overlay2"
        },
        "Mounts": [
            {
                "Type": "bind",
                "Source": "/run/desktop/mnt/host/e/GSentinelHealthOS/observability/grafana/provisioning",
                "Destination": "/etc/grafana/provisioning",
                "Mode": "ro",
                "RW": false,
                "Propagation": "rprivate"
            },
            {
                "Type": "volume",
                "Name": "gsentinelhealthos_grafana_data",
                "Source": "/var/lib/docker/volumes/gsentinelhealthos_grafana_data/_data",
                "Destination": "/var/lib/grafana",
                "Driver": "local",
                "Mode": "rw",
                "RW": true,
                "Propagation": ""
            }
        ],
        "Config": {
            "Hostname": "3df091884d4a",
            "Domainname": "",
            "User": "472",
            "AttachStdin": false,
            "AttachStdout": true,
            "AttachStderr": true,
            "ExposedPorts": {
                "3000/tcp": {}
            },
            "Tty": false,
            "OpenStdin": false,
            "StdinOnce": false,
            "Env": [
                "GF_SERVER_DOMAIN=localhost",
                "GF_ANALYTICS_CHECK_FOR_UPDATES=false",
                "GF_LOG_LEVEL=warn",
                "GF_ANALYTICS_REPORTING_ENABLED=false",
                "GF_SECURITY_DISABLE_GRAVATAR=true",
                "GF_SECURITY_ADMIN_USER=admin",
                "GF_USERS_ALLOW_SIGN_UP=false",
                "GF_SECURITY_ADMIN_PASSWORD=",
                "PATH=/usr/share/grafana/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
                "GF_PATHS_CONFIG=/etc/grafana/grafana.ini",
                "GF_PATHS_DATA=/var/lib/grafana",
                "GF_PATHS_HOME=/usr/share/grafana",
                "GF_PATHS_LOGS=/var/log/grafana",
                "GF_PATHS_PLUGINS=/var/lib/grafana/plugins",
                "GF_PATHS_PROVISIONING=/etc/grafana/provisioning"
            ],
            "Cmd": null,
            "Healthcheck": {
                "Test": [
                    "CMD",
                    "wget",
                    "--no-verbose",
                    "--tries=1",
                    "--spider",
                    "http://localhost:3000/api/health"
                ],
                "Interval": 15000000000,
                "Timeout": 5000000000,
                "Retries": 3
            },
            "Image": "grafana/grafana:10.4.2",
            "Volumes": null,
            "WorkingDir": "/usr/share/grafana",
            "Entrypoint": [
                "/run.sh"
            ],
            "Labels": {
                "com.docker.compose.config-hash": "9446469a1b1649db7e049d3c0d55b4d75847329a56e2843d7d8b8e27d17c8827",
                "com.docker.compose.container-number": "1",
                "com.docker.compose.depends_on": "prometheus:service_healthy:false",
                "com.docker.compose.image": "sha256:679e4be9f9184b60905bc3c9297d293d0070f1d1155017877cf0199b1f1b787c",
                "com.docker.compose.oneoff": "False",
                "com.docker.compose.project": "gsentinelhealthos",
                "com.docker.compose.project.config_files": "E:\\GSentinelHealthOS\\docker-compose.yml",
                "com.docker.compose.project.working_dir": "E:\\GSentinelHealthOS",
                "com.docker.compose.service": "grafana",
                "com.docker.compose.version": "5.1.0",
                "maintainer": "Grafana Labs \u003chello@grafana.com\u003e"
            },
            "StopTimeout": 1
        },
        "NetworkSettings": {
            "SandboxID": "82af772abec793599c5694a3e67ffb30dc3fc75e5353d11b6e39d41e63e1bc36",
            "SandboxKey": "/var/run/docker/netns/82af772abec7",
            "Ports": {
                "3000/tcp": []
            },
            "Networks": {
                "gsentinelhealthos_gs_prod": {
                    "IPAMConfig": null,
                    "Links": null,
                    "Aliases": [
                        "gs_grafana",
                        "grafana"
                    ],
                    "DriverOpts": null,
                    "GwPriority": 0,
                    "NetworkID": "919bd5f232a0b0588e6ca20e3c563d7ca6731d36e1524f9f82fd1a1f698a1813",
                    "EndpointID": "6d6fa8370f794e0e7192c7ad49c5d07dd272109e35eae0b63b3b6d9835b7fe8d",
                    "Gateway": "172.20.0.1",
                    "IPAddress": "172.20.0.12",
                    "MacAddress": "7e:c1:59:c3:23:03",
                    "IPPrefixLen": 16,
                    "IPv6Gateway": "",
                    "GlobalIPv6Address": "",
                    "GlobalIPv6PrefixLen": 0,
                    "DNSNames": [
                        "gs_grafana",
                        "grafana",
                        "3df091884d4a"
                    ]
                }
            }
        }
    },
    {
        "Id": "e80aafb3c4d08cd6c8ab3cb687f3af649987d286663b277a100f3b8e7d88ff84",
        "Created": "2026-05-16T21:19:49.240453391Z",
        "Path": "/usr/bin/promtail",
        "Args": [
            "-config.file=/etc/promtail/promtail-config.yml"
        ],
        "State": {
            "Status": "running",
            "Running": true,
            "Paused": false,
            "Restarting": false,
            "OOMKilled": false,
            "Dead": false,
            "Pid": 1527,
            "ExitCode": 0,
            "Error": "",
            "StartedAt": "2026-05-18T21:45:20.147390123Z",
            "FinishedAt": "2026-05-18T21:45:16.194051229Z"
        },
        "Image": "sha256:5ff0658d61a6e5c6a9acd8269cd78f43701bb1f87a76c7fb99e70dbacef8dfff",
        "ResolvConfPath": "/var/lib/docker/containers/e80aafb3c4d08cd6c8ab3cb687f3af649987d286663b277a100f3b8e7d88ff84/resolv.conf",
        "HostnamePath": "/var/lib/docker/containers/e80aafb3c4d08cd6c8ab3cb687f3af649987d286663b277a100f3b8e7d88ff84/hostname",
        "HostsPath": "/var/lib/docker/containers/e80aafb3c4d08cd6c8ab3cb687f3af649987d286663b277a100f3b8e7d88ff84/hosts",
        "LogPath": "/var/lib/docker/containers/e80aafb3c4d08cd6c8ab3cb687f3af649987d286663b277a100f3b8e7d88ff84/e80aafb3c4d08cd6c8ab3cb687f3af649987d286663b277a100f3b8e7d88ff84-json.log",
        "Name": "/gs_promtail",
        "RestartCount": 0,
        "Driver": "overlay2",
        "Platform": "linux",
        "MountLabel": "",
        "ProcessLabel": "",
        "AppArmorProfile": "",
        "ExecIDs": null,
        "HostConfig": {
            "Binds": [
                "E:\\GSentinelHealthOS\\observability\\promtail-config.yml:/etc/promtail/promtail-config.yml:ro",
                "/var/lib/docker/containers:/var/lib/docker/containers:ro",
                "/var/run/docker.sock:/var/run/docker.sock:ro"
            ],
            "ContainerIDFile": "",
            "LogConfig": {
                "Type": "json-file",
                "Config": {
                    "max-file": "2",
                    "max-size": "5m"
                }
            },
            "NetworkMode": "gsentinelhealthos_gs_prod",
            "PortBindings": {},
            "RestartPolicy": {
                "Name": "unless-stopped",
                "MaximumRetryCount": 0
            },
            "AutoRemove": false,
            "VolumeDriver": "",
            "VolumesFrom": null,
            "ConsoleSize": [
                0,
                0
            ],
            "CapAdd": null,
            "CapDrop": null,
            "CgroupnsMode": "private",
            "Dns": [],
            "DnsOptions": [],
            "DnsSearch": [],
            "ExtraHosts": [],
            "GroupAdd": null,
            "IpcMode": "private",
            "Cgroup": "",
            "Links": null,
            "OomScoreAdj": 0,
            "PidMode": "",
            "Privileged": false,
            "PublishAllPorts": false,
            "ReadonlyRootfs": false,
            "SecurityOpt": [
                "no-new-privileges:true"
            ],
            "UTSMode": "",
            "UsernsMode": "",
            "ShmSize": 67108864,
            "Runtime": "runc",
            "Isolation": "",
            "CpuShares": 0,
            "Memory": 134217728,
            "NanoCpus": 250000000,
            "CgroupParent": "",
            "BlkioWeight": 0,
            "BlkioWeightDevice": null,
            "BlkioDeviceReadBps": null,
            "BlkioDeviceWriteBps": null,
            "BlkioDeviceReadIOps": null,
            "BlkioDeviceWriteIOps": null,
            "CpuPeriod": 0,
            "CpuQuota": 0,
            "CpuRealtimePeriod": 0,
            "CpuRealtimeRuntime": 0,
            "CpusetCpus": "",
            "CpusetMems": "",
            "Devices": null,
            "DeviceCgroupRules": null,
            "DeviceRequests": null,
            "MemoryReservation": 0,
            "MemorySwap": 268435456,
            "MemorySwappiness": null,
            "OomKillDisable": null,
            "PidsLimit": null,
            "Ulimits": null,
            "CpuCount": 0,
            "CpuPercent": 0,
            "IOMaximumIOps": 0,
            "IOMaximumBandwidth": 0,
            "MaskedPaths": [
                "/proc/acpi",
                "/proc/asound",
                "/proc/interrupts",
                "/proc/kcore",
                "/proc/keys",
                "/proc/latency_stats",
                "/proc/sched_debug",
                "/proc/scsi",
                "/proc/timer_list",
                "/proc/timer_stats",
                "/sys/devices/virtual/powercap",
                "/sys/firmware"
            ],
            "ReadonlyPaths": [
                "/proc/bus",
                "/proc/fs",
                "/proc/irq",
                "/proc/sys",
                "/proc/sysrq-trigger"
            ]
        },
        "GraphDriver": {
            "Data": {
                "ID": "e80aafb3c4d08cd6c8ab3cb687f3af649987d286663b277a100f3b8e7d88ff84",
                "LowerDir": "/var/lib/docker/overlay2/0df891013525acffb8610ee17046854ed308f2ec6d67a5c2a1ec6903f6c2f482-init/diff:/var/lib/docker/overlay2/10c430c8fb3fe4a1888cba4b46e03d011a2ef6e07dd36c0e697c8ad70ffdbede/diff:/var/lib/docker/overlay2/7b61dccd4a0ee5981bf0ad6e00e5b18cd6ef22f399dec235dbe38d74f3d218de/diff:/var/lib/docker/overlay2/b80efd24ec5396af5afdaa41ecbdadefbdd65fcd15ee88db7a38e4a63f9002c3/diff:/var/lib/docker/overlay2/ff849ef35e25890dcfcf68347388367291efa68fd024b61a2197aff54578b5ce/diff:/var/lib/docker/overlay2/b489c7bf11da399f55babcb2c9c98020b81fb5701ca5d1f8500764474d5f591f/diff:/var/lib/docker/overlay2/338c94bc2ec0c93f3fc86f08953003b53088f69b2cac944f1adb1180f43e0e77/diff",
                "MergedDir": "/var/lib/docker/overlay2/0df891013525acffb8610ee17046854ed308f2ec6d67a5c2a1ec6903f6c2f482/merged",
                "UpperDir": "/var/lib/docker/overlay2/0df891013525acffb8610ee17046854ed308f2ec6d67a5c2a1ec6903f6c2f482/diff",
                "WorkDir": "/var/lib/docker/overlay2/0df891013525acffb8610ee17046854ed308f2ec6d67a5c2a1ec6903f6c2f482/work"
            },
            "Name": "overlay2"
        },
        "Mounts": [
            {
                "Type": "bind",
                "Source": "/var/lib/docker/containers",
                "Destination": "/var/lib/docker/containers",
                "Mode": "ro",
                "RW": false,
                "Propagation": "rslave"
            },
            {
                "Type": "bind",
                "Source": "/var/run/docker.sock",
                "Destination": "/var/run/docker.sock",
                "Mode": "ro",
                "RW": false,
                "Propagation": "rprivate"
            },
            {
                "Type": "bind",
                "Source": "E:\\GSentinelHealthOS\\observability\\promtail-config.yml",
                "Destination": "/etc/promtail/promtail-config.yml",
                "Mode": "ro",
                "RW": false,
                "Propagation": "rprivate"
            }
        ],
        "Config": {
            "Hostname": "e80aafb3c4d0",
            "Domainname": "",
            "User": "",
            "AttachStdin": false,
            "AttachStdout": true,
            "AttachStderr": true,
            "Tty": false,
            "OpenStdin": false,
            "StdinOnce": false,
            "Env": [
                "PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
            ],
            "Cmd": [
                "-config.file=/etc/promtail/promtail-config.yml"
            ],
            "Image": "grafana/promtail:2.9.8",
            "Volumes": null,
            "WorkingDir": "",
            "Entrypoint": [
                "/usr/bin/promtail"
            ],
            "Labels": {
                "com.docker.compose.config-hash": "30ab702902d57cb88fb8079b1ca3789cb53bdba1287696713ca37b5d53f3f728",
                "com.docker.compose.container-number": "1",
                "com.docker.compose.depends_on": "loki:service_healthy:false",
                "com.docker.compose.image": "sha256:5ff0658d61a6e5c6a9acd8269cd78f43701bb1f87a76c7fb99e70dbacef8dfff",
                "com.docker.compose.oneoff": "False",
                "com.docker.compose.project": "gsentinelhealthos",
                "com.docker.compose.project.config_files": "E:\\GSentinelHealthOS\\docker-compose.yml",
                "com.docker.compose.project.working_dir": "E:\\GSentinelHealthOS",
                "com.docker.compose.service": "promtail",
                "com.docker.compose.version": "5.1.0",
                "org.opencontainers.image.created": "2024-05-03T07:51:12Z",
                "org.opencontainers.image.revision": "94e00299ec9b36ad97c147641566b6922268c54e",
                "org.opencontainers.image.source": "https://github.com/grafana/loki.git",
                "org.opencontainers.image.url": "https://github.com/grafana/loki"
            },
            "StopTimeout": 1
        },
        "NetworkSettings": {
            "SandboxID": "c58c46176c9b41f657173c9409cab20aa3e14e2b254caa7f2d8ccaad49fdfff6",
            "SandboxKey": "/var/run/docker/netns/c58c46176c9b",
            "Ports": {},
            "Networks": {
                "gsentinelhealthos_gs_prod": {
                    "IPAMConfig": null,
                    "Links": null,
                    "Aliases": [
                        "gs_promtail",
                        "promtail"
                    ],
                    "DriverOpts": null,
                    "GwPriority": 0,
                    "NetworkID": "919bd5f232a0b0588e6ca20e3c563d7ca6731d36e1524f9f82fd1a1f698a1813",
                    "EndpointID": "3c0bdac3d964e5807a37d80b351bcb93074acc952df30a28d4d67edbd5eea4c9",
                    "Gateway": "172.20.0.1",
                    "IPAddress": "172.20.0.23",
                    "MacAddress": "ce:de:85:46:3b:52",
                    "IPPrefixLen": 16,
                    "IPv6Gateway": "",
                    "GlobalIPv6Address": "",
                    "GlobalIPv6PrefixLen": 0,
                    "DNSNames": [
                        "gs_promtail",
                        "promtail",
                        "e80aafb3c4d0"
                    ]
                }
            }
        }
    },
    {
        "Id": "bb279188331693ea90872a8098e070224139349d843b3c0ab8fc096551508fb9",
        "Created": "2026-05-16T21:19:45.429370275Z",
        "Path": "python",
        "Args": [
            "scripts/run_outbox_scheduler.py"
        ],
        "State": {
            "Status": "running",
            "Running": true,
            "Paused": false,
            "Restarting": false,
            "OOMKilled": false,
            "Dead": false,
            "Pid": 1500,
            "ExitCode": 0,
            "Error": "",
            "StartedAt": "2026-05-18T21:45:20.143281992Z",
            "FinishedAt": "2026-05-18T21:45:16.194266504Z",
            "Health": {
                "Status": "healthy",
                "FailingStreak": 0,
                "Log": [
                    {
                        "Start": "2026-05-19T03:08:46.151005501Z",
                        "End": "2026-05-19T03:08:46.265105598Z",
                        "ExitCode": 0,
                        "Output": ""
                    },
                    {
                        "Start": "2026-05-19T03:09:16.175500463Z",
                        "End": "2026-05-19T03:09:16.280984991Z",
                        "ExitCode": 0,
                        "Output": ""
                    },
                    {
                        "Start": "2026-05-19T03:09:46.160721475Z",
                        "End": "2026-05-19T03:09:46.307055224Z",
                        "ExitCode": 0,
                        "Output": ""
                    },
                    {
                        "Start": "2026-05-19T03:10:16.223231461Z",
                        "End": "2026-05-19T03:10:16.352971788Z",
                        "ExitCode": 0,
                        "Output": ""
                    },
                    {
                        "Start": "2026-05-19T03:10:46.271658987Z",
                        "End": "2026-05-19T03:10:46.342239161Z",
                        "ExitCode": 0,
                        "Output": ""
                    }
                ]
            }
        },
        "Image": "sha256:33778722e6f67a2d33a905e265b70cde4aea88a591e22522e8edf000330d69c2",
        "ResolvConfPath": "/var/lib/docker/containers/bb279188331693ea90872a8098e070224139349d843b3c0ab8fc096551508fb9/resolv.conf",
        "HostnamePath": "/var/lib/docker/containers/bb279188331693ea90872a8098e070224139349d843b3c0ab8fc096551508fb9/hostname",
        "HostsPath": "/var/lib/docker/containers/bb279188331693ea90872a8098e070224139349d843b3c0ab8fc096551508fb9/hosts",
        "LogPath": "/var/lib/docker/containers/bb279188331693ea90872a8098e070224139349d843b3c0ab8fc096551508fb9/bb279188331693ea90872a8098e070224139349d843b3c0ab8fc096551508fb9-json.log",
        "Name": "/gs_outbox_scheduler",
        "RestartCount": 0,
        "Driver": "overlay2",
        "Platform": "linux",
        "MountLabel": "",
        "ProcessLabel": "",
        "AppArmorProfile": "",
        "ExecIDs": null,
        "HostConfig": {
            "Binds": [
                "E:\\GSentinelHealthOS\\scripts:/app/scripts:ro"
            ],
            "ContainerIDFile": "",
            "LogConfig": {
                "Type": "json-file",
                "Config": {
                    "max-file": "3",
                    "max-size": "10m"
                }
            },
            "NetworkMode": "gsentinelhealthos_gs_prod",
            "PortBindings": {},
            "RestartPolicy": {
                "Name": "unless-stopped",
                "MaximumRetryCount": 0
            },
            "AutoRemove": false,
            "VolumeDriver": "",
            "VolumesFrom": null,
            "ConsoleSize": [
                0,
                0
            ],
            "CapAdd": null,
            "CapDrop": null,
            "CgroupnsMode": "private",
            "Dns": [],
            "DnsOptions": [],
            "DnsSearch": [],
            "ExtraHosts": [],
            "GroupAdd": null,
            "IpcMode": "private",
            "Cgroup": "",
            "Links": null,
            "OomScoreAdj": 0,
            "PidMode": "",
            "Privileged": false,
            "PublishAllPorts": false,
            "ReadonlyRootfs": false,
            "SecurityOpt": [
                "no-new-privileges:true"
            ],
            "UTSMode": "",
            "UsernsMode": "",
            "ShmSize": 67108864,
            "Runtime": "runc",
            "Isolation": "",
            "CpuShares": 0,
            "Memory": 536870912,
            "NanoCpus": 750000000,
            "CgroupParent": "",
            "BlkioWeight": 0,
            "BlkioWeightDevice": null,
            "BlkioDeviceReadBps": null,
            "BlkioDeviceWriteBps": null,
            "BlkioDeviceReadIOps": null,
            "BlkioDeviceWriteIOps": null,
            "CpuPeriod": 0,
            "CpuQuota": 0,
            "CpuRealtimePeriod": 0,
            "CpuRealtimeRuntime": 0,
            "CpusetCpus": "",
            "CpusetMems": "",
            "Devices": null,
            "DeviceCgroupRules": null,
            "DeviceRequests": null,
            "MemoryReservation": 0,
            "MemorySwap": 1073741824,
            "MemorySwappiness": null,
            "OomKillDisable": null,
            "PidsLimit": null,
            "Ulimits": null,
            "CpuCount": 0,
            "CpuPercent": 0,
            "IOMaximumIOps": 0,
            "IOMaximumBandwidth": 0,
            "MaskedPaths": [
                "/proc/acpi",
                "/proc/asound",
                "/proc/interrupts",
                "/proc/kcore",
                "/proc/keys",
                "/proc/latency_stats",
                "/proc/sched_debug",
                "/proc/scsi",
                "/proc/timer_list",
                "/proc/timer_stats",
                "/sys/devices/virtual/powercap",
                "/sys/firmware"
            ],
            "ReadonlyPaths": [
                "/proc/bus",
                "/proc/fs",
                "/proc/irq",
                "/proc/sys",
                "/proc/sysrq-trigger"
            ]
        },
        "GraphDriver": {
            "Data": {
                "ID": "bb279188331693ea90872a8098e070224139349d843b3c0ab8fc096551508fb9",
                "LowerDir": "/var/lib/docker/overlay2/ce089212824278dd9d1ba7aa59d886667ddd45b8f4d38498f4589018dbc580d5-init/diff:/var/lib/docker/overlay2/qdmb24mixe0b3rza5k9zjjxki/diff:/var/lib/docker/overlay2/kw8zge4n293p3915lhisrxhe0/diff:/var/lib/docker/overlay2/m9cngs9a259lomsq1eh6pokf8/diff:/var/lib/docker/overlay2/nnkzp2vetr044mhj9k75sblk1/diff:/var/lib/docker/overlay2/tkpkoz38yf7lenhpgvm7nr63i/diff:/var/lib/docker/overlay2/lv0yng4klel6ox1idsg5mtel1/diff:/var/lib/docker/overlay2/1obzj9gdemsnv158vq6izxc7k/diff:/var/lib/docker/overlay2/rypzowr0go2uf0k5zsxmyxbzh/diff:/var/lib/docker/overlay2/iuj2y83rrjygpry10xil67agm/diff:/var/lib/docker/overlay2/sxy0t8g1m4bl21ensdb9362ed/diff:/var/lib/docker/overlay2/s6jncavcrdrgf42sw66c5mznx/diff:/var/lib/docker/overlay2/4f7b9c6374061b0521f67b2ea884a6065bc8d3f33b52e19d235679beb19f8fb5/diff:/var/lib/docker/overlay2/adb64dddc70658da3a1d03108778fbe96f6c7d0bf7dbf5af284b8b68ebad5a4c/diff:/var/lib/docker/overlay2/6fdddc5854355954bd4e66320ec65502c5917d49bb4d289dd8fb86531fd3a21a/diff:/var/lib/docker/overlay2/198bda223fbb6b28c09d5fd3f4a601ad2f4766efb69639765edef544cb6bbb30/diff",
                "MergedDir": "/var/lib/docker/overlay2/ce089212824278dd9d1ba7aa59d886667ddd45b8f4d38498f4589018dbc580d5/merged",
                "UpperDir": "/var/lib/docker/overlay2/ce089212824278dd9d1ba7aa59d886667ddd45b8f4d38498f4589018dbc580d5/diff",
                "WorkDir": "/var/lib/docker/overlay2/ce089212824278dd9d1ba7aa59d886667ddd45b8f4d38498f4589018dbc580d5/work"
            },
            "Name": "overlay2"
        },
        "Mounts": [
            {
                "Type": "bind",
                "Source": "E:\\GSentinelHealthOS\\scripts",
                "Destination": "/app/scripts",
                "Mode": "ro",
                "RW": false,
                "Propagation": "rprivate"
            }
        ],
        "Config": {
            "Hostname": "bb2791883316",
            "Domainname": "",
            "User": "appuser",
            "AttachStdin": false,
            "AttachStdout": true,
            "AttachStderr": true,
            "Tty": false,
            "OpenStdin": false,
            "StdinOnce": false,
            "Env": [
                "ENV=production",
                "GOOGLE_CALENDAR_WEBHOOK_TOKEN=",
                "LOG_FORMAT=json",
                "REDIS_QUEUE_PREFIX=queue:",
                "OUTBOX_SCHEDULER_INTERVAL_SECONDS=15",
                "REDIS_SENTINEL_MASTER=mymaster",
                "GOOGLE_SERVICE_ACCOUNT_JSON_BASE64=",
                "REDIS_STATE_PREFIX=state:",
                "GOOGLE_SERVICE_ACCOUNT_FILE=",
                "LOG_LEVEL=INFO",
                "GOOGLE_SERVICE_ACCOUNT_JSON=",
                "REDIS_URL=redis://:bDAhxY9Af2LcR86iXN7U9gBIDpGeVuaiiKPLBTvEqLP2vbvy@redis-master:6379",
                "GOOGLE_CALENDAR_ID=primary",
                "OUTBOX_PROCESS_LIMIT=200",
                "BRAIN_API_KEY=BRAIN_KEY_REDACTED",
                "REDIS_SENTINELS=redis-sentinel-1:26379,redis-sentinel-2:26379,redis-sentinel-3:26379",
                "JWT_SECRET=fGd8p7xXW3FtuPco5zM4QOsHlmwgNKiJ9TrvYCEnab2Z1LqS",
                "GOOGLE_CALENDAR_WEBHOOK_CALLBACK_URL=",
                "GOOGLE_CALENDAR_TIMEZONE=America/Argentina/Buenos_Aires",
                "REDIS_CACHE_PREFIX=cache:",
                "GOOGLE_CALENDAR_AUTH_MODE=service_account",
                "GOOGLE_OAUTH_CLIENT_SECRET_FILE=",
                "REDIS_SENTINEL_PASSWORD=bDAhxY9Af2LcR86iXN7U9gBIDpGeVuaiiKPLBTvEqLP2vbvy",
                "GATEWAY_API_KEY=GATEWAY_KEY_REDACTED",
                "DATABASE_URL=postgresql+psycopg://sentinel:OzMTDZYpxmFNivfGStWo0kB6Xb85Uweh@db:5432/gsentinel",
                "GOOGLE_CALENDAR_WATCH_TTL_SECONDS=86400",
                "GOOGLE_OAUTH_TOKEN_FILE=",
                "GOOGLE_CALENDAR_ENABLED=false",
                "PATH=/usr/local/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
                "LANG=C.UTF-8",
                "GPG_KEY=A035C8C19219BA821ECEA86B64E628F8D684696D",
                "PYTHON_VERSION=3.11.15",
                "PYTHON_SHA256=272179ddd9a2e41a0fc8e42e33dfbdca0b3711aa5abf372d3f2d51543d09b625"
            ],
            "Cmd": [
                "python",
                "scripts/run_outbox_scheduler.py"
            ],
            "Healthcheck": {
                "Test": [
                    "CMD-SHELL",
                    "python -c \"import socket; socket.create_connection(('db', 5432), 2).close(); socket.create_connection(('redis-master', 6379), 2).close()\""
                ],
                "Interval": 30000000000,
                "Timeout": 10000000000,
                "StartPeriod": 15000000000,
                "Retries": 3
            },
            "Image": "gsentinelhealthos-outbox_scheduler",
            "Volumes": null,
            "WorkingDir": "/app",
            "Entrypoint": null,
            "Labels": {
                "com.docker.compose.config-hash": "17a6ede5ce26812e68dc4cb05d864509bda6a3d26b1d931c99f2d4f31e9fcaca",
                "com.docker.compose.container-number": "1",
                "com.docker.compose.depends_on": "db:service_healthy:false,redis-master:service_healthy:false,redis-sentinel-1:service_healthy:false",
                "com.docker.compose.image": "sha256:33778722e6f67a2d33a905e265b70cde4aea88a591e22522e8edf000330d69c2",
                "com.docker.compose.oneoff": "False",
                "com.docker.compose.project": "gsentinelhealthos",
                "com.docker.compose.project.config_files": "E:\\GSentinelHealthOS\\docker-compose.yml",
                "com.docker.compose.project.working_dir": "E:\\GSentinelHealthOS",
                "com.docker.compose.replace": "gs_outbox_scheduler",
                "com.docker.compose.service": "outbox_scheduler",
                "com.docker.compose.version": "5.1.0"
            },
            "StopTimeout": 1
        },
        "NetworkSettings": {
            "SandboxID": "b2b7f12d7670d7d9ce1cd5b3645d835b5b28604f2d9329d9ffe0de66f0f1299a",
            "SandboxKey": "/var/run/docker/netns/b2b7f12d7670",
            "Ports": {},
            "Networks": {
                "gsentinelhealthos_gs_prod": {
                    "IPAMConfig": null,
                    "Links": null,
                    "Aliases": [
                        "gs_outbox_scheduler",
                        "outbox_scheduler"
                    ],
                    "DriverOpts": null,
                    "GwPriority": 0,
                    "NetworkID": "919bd5f232a0b0588e6ca20e3c563d7ca6731d36e1524f9f82fd1a1f698a1813",
                    "EndpointID": "cae294a932e405d3c1656436c532bae6657b91d76064c62000ebec718139b854",
                    "Gateway": "172.20.0.1",
                    "IPAddress": "172.20.0.14",
                    "MacAddress": "16:87:25:35:fd:cf",
                    "IPPrefixLen": 16,
                    "IPv6Gateway": "",
                    "GlobalIPv6Address": "",
                    "GlobalIPv6PrefixLen": 0,
                    "DNSNames": [
                        "gs_outbox_scheduler",
                        "outbox_scheduler",
                        "bb2791883316"
                    ]
                }
            }
        }
    },
    {
        "Id": "b04b000bb654644218447a462650e3c5a04aa1cb3aafaefdba959811e4506a73",
        "Created": "2026-05-16T21:19:45.38305166Z",
        "Path": "uvicorn",
        "Args": [
            "whatsapp_gateway.app.main:app",
            "--host",
            "0.0.0.0",
            "--port",
            "8002"
        ],
        "State": {
            "Status": "running",
            "Running": true,
            "Paused": false,
            "Restarting": false,
            "OOMKilled": false,
            "Dead": false,
            "Pid": 1091,
            "ExitCode": 0,
            "Error": "",
            "StartedAt": "2026-05-18T21:45:20.037448306Z",
            "FinishedAt": "2026-05-18T21:45:16.193975727Z",
            "Health": {
                "Status": "healthy",
                "FailingStreak": 0,
                "Log": [
                    {
                        "Start": "2026-05-19T03:08:37.305216061Z",
                        "End": "2026-05-19T03:08:37.478027413Z",
                        "ExitCode": 0,
                        "Output": ""
                    },
                    {
                        "Start": "2026-05-19T03:09:07.388664918Z",
                        "End": "2026-05-19T03:09:07.538008381Z",
                        "ExitCode": 0,
                        "Output": ""
                    },
                    {
                        "Start": "2026-05-19T03:09:37.417530891Z",
                        "End": "2026-05-19T03:09:37.56931705Z",
                        "ExitCode": 0,
                        "Output": ""
                    },
                    {
                        "Start": "2026-05-19T03:10:07.484947604Z",
                        "End": "2026-05-19T03:10:07.660964208Z",
                        "ExitCode": 0,
                        "Output": ""
                    },
                    {
                        "Start": "2026-05-19T03:10:37.579533046Z",
                        "End": "2026-05-19T03:10:37.718311678Z",
                        "ExitCode": 0,
                        "Output": ""
                    }
                ]
            }
        },
        "Image": "sha256:a9bb2547b9cbbe78c8a548ee89d665013061569fe5fb184369cb3ba593b026b8",
        "ResolvConfPath": "/var/lib/docker/containers/b04b000bb654644218447a462650e3c5a04aa1cb3aafaefdba959811e4506a73/resolv.conf",
        "HostnamePath": "/var/lib/docker/containers/b04b000bb654644218447a462650e3c5a04aa1cb3aafaefdba959811e4506a73/hostname",
        "HostsPath": "/var/lib/docker/containers/b04b000bb654644218447a462650e3c5a04aa1cb3aafaefdba959811e4506a73/hosts",
        "LogPath": "/var/lib/docker/containers/b04b000bb654644218447a462650e3c5a04aa1cb3aafaefdba959811e4506a73/b04b000bb654644218447a462650e3c5a04aa1cb3aafaefdba959811e4506a73-json.log",
        "Name": "/gs_gateway",
        "RestartCount": 0,
        "Driver": "overlay2",
        "Platform": "linux",
        "MountLabel": "",
        "ProcessLabel": "",
        "AppArmorProfile": "",
        "ExecIDs": null,
        "HostConfig": {
            "Binds": [
                "gsentinelhealthos_uploads_data:/data/uploads:rw"
            ],
            "ContainerIDFile": "",
            "LogConfig": {
                "Type": "json-file",
                "Config": {
                    "max-file": "3",
                    "max-size": "10m"
                }
            },
            "NetworkMode": "gsentinelhealthos_gs_prod",
            "PortBindings": {
                "8002/tcp": [
                    {
                        "HostIp": "127.0.0.1",
                        "HostPort": "8002"
                    }
                ]
            },
            "RestartPolicy": {
                "Name": "unless-stopped",
                "MaximumRetryCount": 0
            },
            "AutoRemove": false,
            "VolumeDriver": "",
            "VolumesFrom": null,
            "ConsoleSize": [
                0,
                0
            ],
            "CapAdd": null,
            "CapDrop": null,
            "CgroupnsMode": "private",
            "Dns": [],
            "DnsOptions": [],
            "DnsSearch": [],
            "ExtraHosts": [],
            "GroupAdd": null,
            "IpcMode": "private",
            "Cgroup": "",
            "Links": null,
            "OomScoreAdj": 0,
            "PidMode": "",
            "Privileged": false,
            "PublishAllPorts": false,
            "ReadonlyRootfs": false,
            "SecurityOpt": [
                "no-new-privileges:true"
            ],
            "UTSMode": "",
            "UsernsMode": "",
            "ShmSize": 67108864,
            "Runtime": "runc",
            "Isolation": "",
            "CpuShares": 0,
            "Memory": 536870912,
            "NanoCpus": 750000000,
            "CgroupParent": "",
            "BlkioWeight": 0,
            "BlkioWeightDevice": null,
            "BlkioDeviceReadBps": null,
            "BlkioDeviceWriteBps": null,
            "BlkioDeviceReadIOps": null,
            "BlkioDeviceWriteIOps": null,
            "CpuPeriod": 0,
            "CpuQuota": 0,
            "CpuRealtimePeriod": 0,
            "CpuRealtimeRuntime": 0,
            "CpusetCpus": "",
            "CpusetMems": "",
            "Devices": null,
            "DeviceCgroupRules": null,
            "DeviceRequests": null,
            "MemoryReservation": 0,
            "MemorySwap": 1073741824,
            "MemorySwappiness": null,
            "OomKillDisable": null,
            "PidsLimit": null,
            "Ulimits": null,
            "CpuCount": 0,
            "CpuPercent": 0,
            "IOMaximumIOps": 0,
            "IOMaximumBandwidth": 0,
            "MaskedPaths": [
                "/proc/acpi",
                "/proc/asound",
                "/proc/interrupts",
                "/proc/kcore",
                "/proc/keys",
                "/proc/latency_stats",
                "/proc/sched_debug",
                "/proc/scsi",
                "/proc/timer_list",
                "/proc/timer_stats",
                "/sys/devices/virtual/powercap",
                "/sys/firmware"
            ],
            "ReadonlyPaths": [
                "/proc/bus",
                "/proc/fs",
                "/proc/irq",
                "/proc/sys",
                "/proc/sysrq-trigger"
            ]
        },
        "GraphDriver": {
            "Data": {
                "ID": "b04b000bb654644218447a462650e3c5a04aa1cb3aafaefdba959811e4506a73",
                "LowerDir": "/var/lib/docker/overlay2/5c6f16d069792a2d36de526db71e17efaf04b7724ec676cbfa811684a37249ff-init/diff:/var/lib/docker/overlay2/laluixentihh9q0nup1rgecbj/diff:/var/lib/docker/overlay2/ead2hzb5m2pfa1cjvw51x36jz/diff:/var/lib/docker/overlay2/3geueidua6vavqty6bdv8o477/diff:/var/lib/docker/overlay2/qk8z131b7yncn9lwfklrbix60/diff:/var/lib/docker/overlay2/eu380dsr5pgo3847zt6ar4azk/diff:/var/lib/docker/overlay2/3vfh7rn24etwvah6n9yehzr8q/diff:/var/lib/docker/overlay2/v9x46rmxz35kxq7bkhsvh6vp1/diff:/var/lib/docker/overlay2/pvr2tu1y62bq6xf77bn3hiecn/diff:/var/lib/docker/overlay2/kyq09cpiuluxfgbsfzu8l2m4q/diff:/var/lib/docker/overlay2/7gzj4c4dtgc88ddnhos6o0ggi/diff:/var/lib/docker/overlay2/8ed60a4496de1672027b59530d5fbb3d6d6075e2b3581b589c86502bad5229c5/diff:/var/lib/docker/overlay2/0425cc4a958c0eb91d61dbec830a422fadf41e07ba4436aa05e6246a7407bafd/diff:/var/lib/docker/overlay2/7ee8eda652e43d72c344c1e51c0405783cb68181481731c86eaf1de8abaa0950/diff:/var/lib/docker/overlay2/8fc67f38194de09b879e7b56334bffa27598204a60554a6512aabce9a84221f5/diff",
                "MergedDir": "/var/lib/docker/overlay2/5c6f16d069792a2d36de526db71e17efaf04b7724ec676cbfa811684a37249ff/merged",
                "UpperDir": "/var/lib/docker/overlay2/5c6f16d069792a2d36de526db71e17efaf04b7724ec676cbfa811684a37249ff/diff",
                "WorkDir": "/var/lib/docker/overlay2/5c6f16d069792a2d36de526db71e17efaf04b7724ec676cbfa811684a37249ff/work"
            },
            "Name": "overlay2"
        },
        "Mounts": [
            {
                "Type": "volume",
                "Name": "gsentinelhealthos_uploads_data",
                "Source": "/var/lib/docker/volumes/gsentinelhealthos_uploads_data/_data",
                "Destination": "/data/uploads",
                "Driver": "local",
                "Mode": "rw",
                "RW": true,
                "Propagation": ""
            }
        ],
        "Config": {
            "Hostname": "b04b000bb654",
            "Domainname": "",
            "User": "appuser",
            "AttachStdin": false,
            "AttachStdout": true,
            "AttachStderr": true,
            "ExposedPorts": {
                "8002/tcp": {}
            },
            "Tty": false,
            "OpenStdin": false,
            "StdinOnce": false,
            "Env": [
                "SECRET_ENCRYPTION_KEY=Rd0JhO5AyXmMD89fPSNt6zjKxiF1cbo2",
                "WHATSAPP_API_VERSION=v25.0",
                "GATEWAY_PORT=8002",
                "ENV=production",
                "WHATSAPP_APP_SECRET=5c2881d5ddb3ccd833ae5cd935dda230",
                "REDIS_URL=redis://:bDAhxY9Af2LcR86iXN7U9gBIDpGeVuaiiKPLBTvEqLP2vbvy@redis-master:6379",
                "DATABASE_URL=postgresql+psycopg://sentinel:OzMTDZYpxmFNivfGStWo0kB6Xb85Uweh@db:5432/gsentinel",
                "WHATSAPP_VERIFY_TOKEN=Em-10Taz812-Agus2026",
                "WHATSAPP_PHONE_NUMBER_ID=1093032243892458",
                "LOG_LEVEL=INFO",
                "LOG_FORMAT=json",
                "WHATSAPP_ACCESS_TOKEN=EAARicVwKsqYBRYZAXPvOsEIPrtv28oSZANK28L4SxThrTcfwCVg3JLCFvqKDeSjgDNyIFtiTd1J8ll7kmfXKD9A0ZCAUE6MoSvvJ2IuVkW8aaoLdcmzN5Yl1kPZClK3dxUZCvZCOuju33QtWy4wxtMvZCyqsQpuLrixutEpNM5CNIFBZCUaOzh5jSDF8UwwXnQZDZD",
                "GATEWAY_HOST=0.0.0.0",
                "REDIS_SENTINELS=",
                "WHATSAPP_BUSINESS_ACCOUNT_ID=967835399226590",
                "REDIS_SENTINEL_MASTER=",
                "ENABLE_WHATSAPP_GATEWAY=true",
                "PATH=/usr/local/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
                "LANG=C.UTF-8",
                "GPG_KEY=A035C8C19219BA821ECEA86B64E628F8D684696D",
                "PYTHON_VERSION=3.11.11",
                "PYTHON_SHA256=2a9920c7a0cd236de33644ed980a13cbbc21058bfdc528febb6081575ed73be3"
            ],
            "Cmd": [
                "uvicorn",
                "whatsapp_gateway.app.main:app",
                "--host",
                "0.0.0.0",
                "--port",
                "8002"
            ],
            "Healthcheck": {
                "Test": [
                    "CMD-SHELL",
                    "python -c \"import urllib.request; urllib.request.urlopen('http://localhost:8002/health')\" || exit 1"
                ],
                "Interval": 30000000000,
                "Timeout": 10000000000,
                "StartPeriod": 5000000000,
                "Retries": 3
            },
            "Image": "gsentinelhealthos-gateway",
            "Volumes": null,
            "WorkingDir": "/app",
            "Entrypoint": null,
            "Labels": {
                "com.docker.compose.config-hash": "6b532237882ed7b57871af7406b2ed75177f8051e756bbb75e3cd1ec627fb759",
                "com.docker.compose.container-number": "1",
                "com.docker.compose.depends_on": "redis-master:service_healthy:false,api:service_healthy:false",
                "com.docker.compose.image": "sha256:a9bb2547b9cbbe78c8a548ee89d665013061569fe5fb184369cb3ba593b026b8",
                "com.docker.compose.oneoff": "False",
                "com.docker.compose.project": "gsentinelhealthos",
                "com.docker.compose.project.config_files": "E:\\GSentinelHealthOS\\docker-compose.yml",
                "com.docker.compose.project.working_dir": "E:\\GSentinelHealthOS",
                "com.docker.compose.replace": "gs_gateway",
                "com.docker.compose.service": "gateway",
                "com.docker.compose.version": "5.1.0"
            },
            "StopTimeout": 1
        },
        "NetworkSettings": {
            "SandboxID": "a5f40ea0d5e2e27ff737d625124e807ab1a93f738004cb4848b2cbb45f0bee1e",
            "SandboxKey": "/var/run/docker/netns/a5f40ea0d5e2",
            "Ports": {
                "8002/tcp": []
            },
            "Networks": {
                "gsentinelhealthos_gs_prod": {
                    "IPAMConfig": null,
                    "Links": null,
                    "Aliases": [
                        "gs_gateway",
                        "gateway"
                    ],
                    "DriverOpts": null,
                    "GwPriority": 0,
                    "NetworkID": "919bd5f232a0b0588e6ca20e3c563d7ca6731d36e1524f9f82fd1a1f698a1813",
                    "EndpointID": "79b038207b1c90e9e34744b024c1b6c0d2ad44d19affb8b1bf2805fa4b41b0ac",
                    "Gateway": "172.20.0.1",
                    "IPAddress": "172.20.0.18",
                    "MacAddress": "56:fe:ce:ba:a3:7e",
                    "IPPrefixLen": 16,
                    "IPv6Gateway": "",
                    "GlobalIPv6Address": "",
                    "GlobalIPv6PrefixLen": 0,
                    "DNSNames": [
                        "gs_gateway",
                        "gateway",
                        "b04b000bb654"
                    ]
                }
            }
        }
    },
    {
        "Id": "f682ef494b87cfa47a2fa707c969a0da90c3a86f8f8c43cdd284a06e38594f69",
        "Created": "2026-05-16T21:19:45.267548551Z",
        "Path": "/usr/bin/loki",
        "Args": [
            "-config.file=/etc/loki/loki-config.yml"
        ],
        "State": {
            "Status": "running",
            "Running": true,
            "Paused": false,
            "Restarting": false,
            "OOMKilled": false,
            "Dead": false,
            "Pid": 1483,
            "ExitCode": 0,
            "Error": "",
            "StartedAt": "2026-05-18T21:45:20.118322954Z",
            "FinishedAt": "2026-05-18T21:45:16.190293811Z",
            "Health": {
                "Status": "healthy",
                "FailingStreak": 0,
                "Log": [
                    {
                        "Start": "2026-05-19T03:09:51.15685637Z",
                        "End": "2026-05-19T03:09:51.198229111Z",
                        "ExitCode": 0,
                        "Output": "Connecting to localhost:3100 ([::1]:3100)\nremote file exists\n"
                    },
                    {
                        "Start": "2026-05-19T03:10:06.113406461Z",
                        "End": "2026-05-19T03:10:06.17393621Z",
                        "ExitCode": 0,
                        "Output": "Connecting to localhost:3100 ([::1]:3100)\nremote file exists\n"
                    },
                    {
                        "Start": "2026-05-19T03:10:21.175327947Z",
                        "End": "2026-05-19T03:10:21.245585376Z",
                        "ExitCode": 0,
                        "Output": "Connecting to localhost:3100 ([::1]:3100)\nremote file exists\n"
                    },
                    {
                        "Start": "2026-05-19T03:10:36.164172346Z",
                        "End": "2026-05-19T03:10:36.237513096Z",
                        "ExitCode": 0,
                        "Output": "Connecting to localhost:3100 ([::1]:3100)\nremote file exists\n"
                    },
                    {
                        "Start": "2026-05-19T03:10:51.238808855Z",
                        "End": "2026-05-19T03:10:51.304148783Z",
                        "ExitCode": 0,
                        "Output": "Connecting to localhost:3100 ([::1]:3100)\nremote file exists\n"
                    }
                ]
            }
        },
        "Image": "sha256:105db0731131ce0a837c6b422d2c96d4e26eed348f1168c884815bf2052e1212",
        "ResolvConfPath": "/var/lib/docker/containers/f682ef494b87cfa47a2fa707c969a0da90c3a86f8f8c43cdd284a06e38594f69/resolv.conf",
        "HostnamePath": "/var/lib/docker/containers/f682ef494b87cfa47a2fa707c969a0da90c3a86f8f8c43cdd284a06e38594f69/hostname",
        "HostsPath": "/var/lib/docker/containers/f682ef494b87cfa47a2fa707c969a0da90c3a86f8f8c43cdd284a06e38594f69/hosts",
        "LogPath": "/var/lib/docker/containers/f682ef494b87cfa47a2fa707c969a0da90c3a86f8f8c43cdd284a06e38594f69/f682ef494b87cfa47a2fa707c969a0da90c3a86f8f8c43cdd284a06e38594f69-json.log",
        "Name": "/gs_loki",
        "RestartCount": 0,
        "Driver": "overlay2",
        "Platform": "linux",
        "MountLabel": "",
        "ProcessLabel": "",
        "AppArmorProfile": "",
        "ExecIDs": null,
        "HostConfig": {
            "Binds": [
                "E:\\GSentinelHealthOS\\observability\\loki-config.yml:/etc/loki/loki-config.yml:ro",
                "gsentinelhealthos_loki_data:/loki:rw"
            ],
            "ContainerIDFile": "",
            "LogConfig": {
                "Type": "json-file",
                "Config": {
                    "max-file": "3",
                    "max-size": "10m"
                }
            },
            "NetworkMode": "gsentinelhealthos_gs_prod",
            "PortBindings": {
                "3100/tcp": [
                    {
                        "HostIp": "127.0.0.1",
                        "HostPort": "3100"
                    }
                ]
            },
            "RestartPolicy": {
                "Name": "unless-stopped",
                "MaximumRetryCount": 0
            },
            "AutoRemove": false,
            "VolumeDriver": "",
            "VolumesFrom": null,
            "ConsoleSize": [
                0,
                0
            ],
            "CapAdd": null,
            "CapDrop": null,
            "CgroupnsMode": "private",
            "Dns": [],
            "DnsOptions": [],
            "DnsSearch": [],
            "ExtraHosts": [],
            "GroupAdd": null,
            "IpcMode": "private",
            "Cgroup": "",
            "Links": null,
            "OomScoreAdj": 0,
            "PidMode": "",
            "Privileged": false,
            "PublishAllPorts": false,
            "ReadonlyRootfs": false,
            "SecurityOpt": [
                "no-new-privileges:true"
            ],
            "UTSMode": "",
            "UsernsMode": "",
            "ShmSize": 67108864,
            "Runtime": "runc",
            "Isolation": "",
            "CpuShares": 0,
            "Memory": 536870912,
            "NanoCpus": 500000000,
            "CgroupParent": "",
            "BlkioWeight": 0,
            "BlkioWeightDevice": null,
            "BlkioDeviceReadBps": null,
            "BlkioDeviceWriteBps": null,
            "BlkioDeviceReadIOps": null,
            "BlkioDeviceWriteIOps": null,
            "CpuPeriod": 0,
            "CpuQuota": 0,
            "CpuRealtimePeriod": 0,
            "CpuRealtimeRuntime": 0,
            "CpusetCpus": "",
            "CpusetMems": "",
            "Devices": null,
            "DeviceCgroupRules": null,
            "DeviceRequests": null,
            "MemoryReservation": 0,
            "MemorySwap": 1073741824,
            "MemorySwappiness": null,
            "OomKillDisable": null,
            "PidsLimit": null,
            "Ulimits": null,
            "CpuCount": 0,
            "CpuPercent": 0,
            "IOMaximumIOps": 0,
            "IOMaximumBandwidth": 0,
            "MaskedPaths": [
                "/proc/acpi",
                "/proc/asound",
                "/proc/interrupts",
                "/proc/kcore",
                "/proc/keys",
                "/proc/latency_stats",
                "/proc/sched_debug",
                "/proc/scsi",
                "/proc/timer_list",
                "/proc/timer_stats",
                "/sys/devices/virtual/powercap",
                "/sys/firmware"
            ],
            "ReadonlyPaths": [
                "/proc/bus",
                "/proc/fs",
                "/proc/irq",
                "/proc/sys",
                "/proc/sysrq-trigger"
            ]
        },
        "GraphDriver": {
            "Data": {
                "ID": "f682ef494b87cfa47a2fa707c969a0da90c3a86f8f8c43cdd284a06e38594f69",
                "LowerDir": "/var/lib/docker/overlay2/03d34c2bf8dcabe76a45c6588b0562daa324d3f9653618ee4c6c35cca6a2af9b-init/diff:/var/lib/docker/overlay2/c027b569fd7de506f61eb3c5714835763a27201d7d2c71effaf15afe76b3622b/diff:/var/lib/docker/overlay2/33cf29b7bc0a10b3dceb64e53addfe905e074cb547664470c2cf933e23716791/diff:/var/lib/docker/overlay2/e383963277df06894650b64287dd7c8821174c8b7e56909aba09408899db6536/diff:/var/lib/docker/overlay2/d92f8026b36c5c24be46f717f6d6a0f2d18b0e164c8e40d9d0ab1269c4e8ddc8/diff:/var/lib/docker/overlay2/5e2c830355e10e1e390f54d9d9bf7ed1b5ebb924fa9d31bd958a11c9b55aba2f/diff:/var/lib/docker/overlay2/8ff689bb43136bf238cbf108fdf0981c81964c44cd615b0e27ff73a0d328892d/diff",
                "MergedDir": "/var/lib/docker/overlay2/03d34c2bf8dcabe76a45c6588b0562daa324d3f9653618ee4c6c35cca6a2af9b/merged",
                "UpperDir": "/var/lib/docker/overlay2/03d34c2bf8dcabe76a45c6588b0562daa324d3f9653618ee4c6c35cca6a2af9b/diff",
                "WorkDir": "/var/lib/docker/overlay2/03d34c2bf8dcabe76a45c6588b0562daa324d3f9653618ee4c6c35cca6a2af9b/work"
            },
            "Name": "overlay2"
        },
        "Mounts": [
            {
                "Type": "bind",
                "Source": "E:\\GSentinelHealthOS\\observability\\loki-config.yml",
                "Destination": "/etc/loki/loki-config.yml",
                "Mode": "ro",
                "RW": false,
                "Propagation": "rprivate"
            },
            {
                "Type": "volume",
                "Name": "gsentinelhealthos_loki_data",
                "Source": "/var/lib/docker/volumes/gsentinelhealthos_loki_data/_data",
                "Destination": "/loki",
                "Driver": "local",
                "Mode": "rw",
                "RW": true,
                "Propagation": ""
            }
        ],
        "Config": {
            "Hostname": "f682ef494b87",
            "Domainname": "",
            "User": "10001",
            "AttachStdin": false,
            "AttachStdout": true,
            "AttachStderr": true,
            "ExposedPorts": {
                "3100/tcp": {}
            },
            "Tty": false,
            "OpenStdin": false,
            "StdinOnce": false,
            "Env": [
                "PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
            ],
            "Cmd": [
                "-config.file=/etc/loki/loki-config.yml"
            ],
            "Healthcheck": {
                "Test": [
                    "CMD",
                    "wget",
                    "--no-verbose",
                    "--tries=1",
                    "--spider",
                    "http://localhost:3100/ready"
                ],
                "Interval": 15000000000,
                "Timeout": 5000000000,
                "Retries": 5
            },
            "Image": "grafana/loki:2.9.8",
            "Volumes": null,
            "WorkingDir": "",
            "Entrypoint": [
                "/usr/bin/loki"
            ],
            "Labels": {
                "com.docker.compose.config-hash": "4fcf796e6fa1122652f7028fbc5ad805ab6e836eb5d1ae44db98698b41f7039c",
                "com.docker.compose.container-number": "1",
                "com.docker.compose.depends_on": "",
                "com.docker.compose.image": "sha256:105db0731131ce0a837c6b422d2c96d4e26eed348f1168c884815bf2052e1212",
                "com.docker.compose.oneoff": "False",
                "com.docker.compose.project": "gsentinelhealthos",
                "com.docker.compose.project.config_files": "E:\\GSentinelHealthOS\\docker-compose.yml",
                "com.docker.compose.project.working_dir": "E:\\GSentinelHealthOS",
                "com.docker.compose.service": "loki",
                "com.docker.compose.version": "5.1.0",
                "org.opencontainers.image.created": "2024-05-03T07:51:15Z",
                "org.opencontainers.image.revision": "94e00299ec9b36ad97c147641566b6922268c54e",
                "org.opencontainers.image.source": "https://github.com/grafana/loki.git",
                "org.opencontainers.image.url": "https://github.com/grafana/loki"
            },
            "StopTimeout": 1
        },
        "NetworkSettings": {
            "SandboxID": "39c37bd07681c95c3634258036f483b34c4c61327f842f833360a4406ee71174",
            "SandboxKey": "/var/run/docker/netns/39c37bd07681",
            "Ports": {
                "3100/tcp": []
            },
            "Networks": {
                "gsentinelhealthos_gs_prod": {
                    "IPAMConfig": null,
                    "Links": null,
                    "Aliases": [
                        "gs_loki",
                        "loki"
                    ],
                    "DriverOpts": null,
                    "GwPriority": 0,
                    "NetworkID": "919bd5f232a0b0588e6ca20e3c563d7ca6731d36e1524f9f82fd1a1f698a1813",
                    "EndpointID": "46d397fe7cf20891ba3ba010637dca6ca7846163ac7d551eeea61469217f24e9",
                    "Gateway": "172.20.0.1",
                    "IPAddress": "172.20.0.20",
                    "MacAddress": "62:0e:57:94:46:d7",
                    "IPPrefixLen": 16,
                    "IPv6Gateway": "",
                    "GlobalIPv6Address": "",
                    "GlobalIPv6PrefixLen": 0,
                    "DNSNames": [
                        "gs_loki",
                        "loki",
                        "f682ef494b87"
                    ]
                }
            }
        }
    },
    {
        "Id": "16eaa7d49191e5f89b87c7476bd4581015251afaa0a11c8b6ae42288dbb51daa",
        "Created": "2026-05-16T21:19:45.251419116Z",
        "Path": "uvicorn",
        "Args": [
            "services.nlg_service.main:app",
            "--host",
            "0.0.0.0",
            "--port",
            "8013",
            "--workers",
            "1"
        ],
        "State": {
            "Status": "running",
            "Running": true,
            "Paused": false,
            "Restarting": false,
            "OOMKilled": false,
            "Dead": false,
            "Pid": 1474,
            "ExitCode": 0,
            "Error": "",
            "StartedAt": "2026-05-18T21:45:20.130567455Z",
            "FinishedAt": "2026-05-18T21:45:16.194261404Z",
            "Health": {
                "Status": "healthy",
                "FailingStreak": 0,
                "Log": [
                    {
                        "Start": "2026-05-19T03:09:03.922836997Z",
                        "End": "2026-05-19T03:09:04.034113383Z",
                        "ExitCode": 0,
                        "Output": ""
                    },
                    {
                        "Start": "2026-05-19T03:09:33.913161437Z",
                        "End": "2026-05-19T03:09:34.042247275Z",
                        "ExitCode": 0,
                        "Output": ""
                    },
                    {
                        "Start": "2026-05-19T03:10:03.958150901Z",
                        "End": "2026-05-19T03:10:04.114817298Z",
                        "ExitCode": 0,
                        "Output": ""
                    },
                    {
                        "Start": "2026-05-19T03:10:34.033381847Z",
                        "End": "2026-05-19T03:10:34.172041409Z",
                        "ExitCode": 0,
                        "Output": ""
                    },
                    {
                        "Start": "2026-05-19T03:11:04.088343825Z",
                        "End": "2026-05-19T03:11:04.186857284Z",
                        "ExitCode": 0,
                        "Output": ""
                    }
                ]
            }
        },
        "Image": "sha256:2347f33098d8d3da63ee4156cf0f3cb3ebde5d6825bb9aaef054a8ec6d3542f2",
        "ResolvConfPath": "/var/lib/docker/containers/16eaa7d49191e5f89b87c7476bd4581015251afaa0a11c8b6ae42288dbb51daa/resolv.conf",
        "HostnamePath": "/var/lib/docker/containers/16eaa7d49191e5f89b87c7476bd4581015251afaa0a11c8b6ae42288dbb51daa/hostname",
        "HostsPath": "/var/lib/docker/containers/16eaa7d49191e5f89b87c7476bd4581015251afaa0a11c8b6ae42288dbb51daa/hosts",
        "LogPath": "/var/lib/docker/containers/16eaa7d49191e5f89b87c7476bd4581015251afaa0a11c8b6ae42288dbb51daa/16eaa7d49191e5f89b87c7476bd4581015251afaa0a11c8b6ae42288dbb51daa-json.log",
        "Name": "/gs_nlg_service",
        "RestartCount": 0,
        "Driver": "overlay2",
        "Platform": "linux",
        "MountLabel": "",
        "ProcessLabel": "",
        "AppArmorProfile": "",
        "ExecIDs": null,
        "HostConfig": {
            "Binds": null,
            "ContainerIDFile": "",
            "LogConfig": {
                "Type": "json-file",
                "Config": {
                    "max-file": "3",
                    "max-size": "10m"
                }
            },
            "NetworkMode": "gsentinelhealthos_gs_prod",
            "PortBindings": {
                "8013/tcp": [
                    {
                        "HostIp": "127.0.0.1",
                        "HostPort": "8013"
                    }
                ]
            },
            "RestartPolicy": {
                "Name": "unless-stopped",
                "MaximumRetryCount": 0
            },
            "AutoRemove": false,
            "VolumeDriver": "",
            "VolumesFrom": null,
            "ConsoleSize": [
                0,
                0
            ],
            "CapAdd": null,
            "CapDrop": null,
            "CgroupnsMode": "private",
            "Dns": [],
            "DnsOptions": [],
            "DnsSearch": [],
            "ExtraHosts": [],
            "GroupAdd": null,
            "IpcMode": "private",
            "Cgroup": "",
            "Links": null,
            "OomScoreAdj": 0,
            "PidMode": "",
            "Privileged": false,
            "PublishAllPorts": false,
            "ReadonlyRootfs": false,
            "SecurityOpt": [
                "no-new-privileges:true"
            ],
            "UTSMode": "",
            "UsernsMode": "",
            "ShmSize": 67108864,
            "Runtime": "runc",
            "Isolation": "",
            "CpuShares": 0,
            "Memory": 536870912,
            "NanoCpus": 750000000,
            "CgroupParent": "",
            "BlkioWeight": 0,
            "BlkioWeightDevice": null,
            "BlkioDeviceReadBps": null,
            "BlkioDeviceWriteBps": null,
            "BlkioDeviceReadIOps": null,
            "BlkioDeviceWriteIOps": null,
            "CpuPeriod": 0,
            "CpuQuota": 0,
            "CpuRealtimePeriod": 0,
            "CpuRealtimeRuntime": 0,
            "CpusetCpus": "",
            "CpusetMems": "",
            "Devices": null,
            "DeviceCgroupRules": null,
            "DeviceRequests": null,
            "MemoryReservation": 0,
            "MemorySwap": 1073741824,
            "MemorySwappiness": null,
            "OomKillDisable": null,
            "PidsLimit": null,
            "Ulimits": null,
            "CpuCount": 0,
            "CpuPercent": 0,
            "IOMaximumIOps": 0,
            "IOMaximumBandwidth": 0,
            "MaskedPaths": [
                "/proc/acpi",
                "/proc/asound",
                "/proc/interrupts",
                "/proc/kcore",
                "/proc/keys",
                "/proc/latency_stats",
                "/proc/sched_debug",
                "/proc/scsi",
                "/proc/timer_list",
                "/proc/timer_stats",
                "/sys/devices/virtual/powercap",
                "/sys/firmware"
            ],
            "ReadonlyPaths": [
                "/proc/bus",
                "/proc/fs",
                "/proc/irq",
                "/proc/sys",
                "/proc/sysrq-trigger"
            ]
        },
        "GraphDriver": {
            "Data": {
                "ID": "16eaa7d49191e5f89b87c7476bd4581015251afaa0a11c8b6ae42288dbb51daa",
                "LowerDir": "/var/lib/docker/overlay2/cb51be02199fbc85a018562b45244baaed2c71a6297c186f9e1396f59e218e69-init/diff:/var/lib/docker/overlay2/rwdvx9asgdiwqaoixsgcrxbl4/diff:/var/lib/docker/overlay2/g0t1ch2id8qeocr74c03lxfji/diff:/var/lib/docker/overlay2/kvdzuonow33bxg9cdxc4iaipb/diff:/var/lib/docker/overlay2/cyarnoy6x06l19u3zi9p46ijw/diff:/var/lib/docker/overlay2/jpx2g85hhsxsyov30egkl8yl7/diff:/var/lib/docker/overlay2/35paiqxwur9otdtfva4bw7ivp/diff:/var/lib/docker/overlay2/7gzj4c4dtgc88ddnhos6o0ggi/diff:/var/lib/docker/overlay2/8ed60a4496de1672027b59530d5fbb3d6d6075e2b3581b589c86502bad5229c5/diff:/var/lib/docker/overlay2/0425cc4a958c0eb91d61dbec830a422fadf41e07ba4436aa05e6246a7407bafd/diff:/var/lib/docker/overlay2/7ee8eda652e43d72c344c1e51c0405783cb68181481731c86eaf1de8abaa0950/diff:/var/lib/docker/overlay2/8fc67f38194de09b879e7b56334bffa27598204a60554a6512aabce9a84221f5/diff",
                "MergedDir": "/var/lib/docker/overlay2/cb51be02199fbc85a018562b45244baaed2c71a6297c186f9e1396f59e218e69/merged",
                "UpperDir": "/var/lib/docker/overlay2/cb51be02199fbc85a018562b45244baaed2c71a6297c186f9e1396f59e218e69/diff",
                "WorkDir": "/var/lib/docker/overlay2/cb51be02199fbc85a018562b45244baaed2c71a6297c186f9e1396f59e218e69/work"
            },
            "Name": "overlay2"
        },
        "Mounts": [],
        "Config": {
            "Hostname": "16eaa7d49191",
            "Domainname": "",
            "User": "appuser",
            "AttachStdin": false,
            "AttachStdout": true,
            "AttachStderr": true,
            "ExposedPorts": {
                "8013/tcp": {}
            },
            "Tty": false,
            "OpenStdin": false,
            "StdinOnce": false,
            "Env": [
                "ENV=production",
                "LOG_LEVEL=INFO",
                "LOG_FORMAT=json",
                "REDIS_URL=redis://:bDAhxY9Af2LcR86iXN7U9gBIDpGeVuaiiKPLBTvEqLP2vbvy@redis-master:6379",
                "INTERNAL_SERVICES_KEY=INTERNAL_KEY_REDACTED",
                "PATH=/usr/local/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
                "LANG=C.UTF-8",
                "GPG_KEY=A035C8C19219BA821ECEA86B64E628F8D684696D",
                "PYTHON_VERSION=3.11.11",
                "PYTHON_SHA256=2a9920c7a0cd236de33644ed980a13cbbc21058bfdc528febb6081575ed73be3",
                "PYTHONPATH=/app/MetaBrain",
                "PYTHONUNBUFFERED=1"
            ],
            "Cmd": [
                "uvicorn",
                "services.nlg_service.main:app",
                "--host",
                "0.0.0.0",
                "--port",
                "8013",
                "--workers",
                "1"
            ],
            "Healthcheck": {
                "Test": [
                    "CMD-SHELL",
                    "python -c \"import urllib.request; urllib.request.urlopen('http://localhost:8013/health')\" || exit 1"
                ],
                "Interval": 30000000000,
                "Timeout": 10000000000,
                "Retries": 3
            },
            "Image": "gsentinelhealthos-nlg-service",
            "Volumes": null,
            "WorkingDir": "/app",
            "Entrypoint": null,
            "Labels": {
                "com.docker.compose.config-hash": "45dbcd973be7a1d30ffa3a97b3f1d2dd7611ff529865b2710a43724a8fb99c3c",
                "com.docker.compose.container-number": "1",
                "com.docker.compose.depends_on": "redis-master:service_healthy:false",
                "com.docker.compose.image": "sha256:2347f33098d8d3da63ee4156cf0f3cb3ebde5d6825bb9aaef054a8ec6d3542f2",
                "com.docker.compose.oneoff": "False",
                "com.docker.compose.project": "gsentinelhealthos",
                "com.docker.compose.project.config_files": "E:\\GSentinelHealthOS\\docker-compose.yml",
                "com.docker.compose.project.working_dir": "E:\\GSentinelHealthOS",
                "com.docker.compose.replace": "gs_nlg_service",
                "com.docker.compose.service": "nlg-service",
                "com.docker.compose.version": "5.1.0"
            },
            "StopTimeout": 1
        },
        "NetworkSettings": {
            "SandboxID": "1a35a5624229767ad37203035a15c6f9614f0fcd88c6f8b8243392527a715494",
            "SandboxKey": "/var/run/docker/netns/1a35a5624229",
            "Ports": {
                "8013/tcp": []
            },
            "Networks": {
                "gsentinelhealthos_gs_prod": {
                    "IPAMConfig": null,
                    "Links": null,
                    "Aliases": [
                        "gs_nlg_service",
                        "nlg-service"
                    ],
                    "DriverOpts": null,
                    "GwPriority": 0,
                    "NetworkID": "919bd5f232a0b0588e6ca20e3c563d7ca6731d36e1524f9f82fd1a1f698a1813",
                    "EndpointID": "8163030a5c5469ac5d4a6c53b1f1a7d640368c8ee8a05e6c35eedf9a11164d67",
                    "Gateway": "172.20.0.1",
                    "IPAddress": "172.20.0.10",
                    "MacAddress": "0e:fe:c9:7f:ca:ee",
                    "IPPrefixLen": 16,
                    "IPv6Gateway": "",
                    "GlobalIPv6Address": "",
                    "GlobalIPv6PrefixLen": 0,
                    "DNSNames": [
                        "gs_nlg_service",
                        "nlg-service",
                        "16eaa7d49191"
                    ]
                }
            }
        }
    },
    {
        "Id": "3fc2fc790746003750d4cc16af7cf198f6cf06440699f969fb444e9887731400",
        "Created": "2026-05-16T21:19:45.242142255Z",
        "Path": "/bin/prometheus",
        "Args": [
            "--config.file=/etc/prometheus/prometheus.yml",
            "--storage.tsdb.path=/prometheus",
            "--storage.tsdb.retention.time=15d",
            "--web.enable-lifecycle",
            "--web.console.libraries=/etc/prometheus/console_libraries",
            "--web.console.templates=/etc/prometheus/consoles"
        ],
        "State": {
            "Status": "running",
            "Running": true,
            "Paused": false,
            "Restarting": false,
            "OOMKilled": false,
            "Dead": false,
            "Pid": 1518,
            "ExitCode": 0,
            "Error": "",
            "StartedAt": "2026-05-18T21:45:20.114264695Z",
            "FinishedAt": "2026-05-18T21:45:16.190394248Z",
            "Health": {
                "Status": "healthy",
                "FailingStreak": 0,
                "Log": [
                    {
                        "Start": "2026-05-19T03:10:06.403245805Z",
                        "End": "2026-05-19T03:10:06.473482229Z",
                        "ExitCode": 0,
                        "Output": "Connecting to localhost:9090 (127.0.0.1:9090)\nremote file exists\n"
                    },
                    {
                        "Start": "2026-05-19T03:10:21.474847123Z",
                        "End": "2026-05-19T03:10:21.530499358Z",
                        "ExitCode": 0,
                        "Output": "Connecting to localhost:9090 (127.0.0.1:9090)\nremote file exists\n"
                    },
                    {
                        "Start": "2026-05-19T03:10:36.449638249Z",
                        "End": "2026-05-19T03:10:36.516416859Z",
                        "ExitCode": 0,
                        "Output": "Connecting to localhost:9090 (127.0.0.1:9090)\nremote file exists\n"
                    },
                    {
                        "Start": "2026-05-19T03:10:51.516977984Z",
                        "End": "2026-05-19T03:10:51.597047734Z",
                        "ExitCode": 0,
                        "Output": "Connecting to localhost:9090 (127.0.0.1:9090)\nremote file exists\n"
                    },
                    {
                        "Start": "2026-05-19T03:11:06.514236036Z",
                        "End": "2026-05-19T03:11:06.579844131Z",
                        "ExitCode": 0,
                        "Output": "Connecting to localhost:9090 (127.0.0.1:9090)\nremote file exists\n"
                    }
                ]
            }
        },
        "Image": "sha256:1d3b7f56885b6dd623f1785be963aa9c195f86bc256ea454e8d02a7980b79c53",
        "ResolvConfPath": "/var/lib/docker/containers/3fc2fc790746003750d4cc16af7cf198f6cf06440699f969fb444e9887731400/resolv.conf",
        "HostnamePath": "/var/lib/docker/containers/3fc2fc790746003750d4cc16af7cf198f6cf06440699f969fb444e9887731400/hostname",
        "HostsPath": "/var/lib/docker/containers/3fc2fc790746003750d4cc16af7cf198f6cf06440699f969fb444e9887731400/hosts",
        "LogPath": "/var/lib/docker/containers/3fc2fc790746003750d4cc16af7cf198f6cf06440699f969fb444e9887731400/3fc2fc790746003750d4cc16af7cf198f6cf06440699f969fb444e9887731400-json.log",
        "Name": "/gs_prometheus",
        "RestartCount": 0,
        "Driver": "overlay2",
        "Platform": "linux",
        "MountLabel": "",
        "ProcessLabel": "",
        "AppArmorProfile": "",
        "ExecIDs": null,
        "HostConfig": {
            "Binds": [
                "E:\\GSentinelHealthOS\\observability\\prometheus.yml:/etc/prometheus/prometheus.yml:ro",
                "gsentinelhealthos_prometheus_data:/prometheus:rw"
            ],
            "ContainerIDFile": "",
            "LogConfig": {
                "Type": "json-file",
                "Config": {
                    "max-file": "3",
                    "max-size": "10m"
                }
            },
            "NetworkMode": "gsentinelhealthos_gs_prod",
            "PortBindings": {
                "9090/tcp": [
                    {
                        "HostIp": "127.0.0.1",
                        "HostPort": "9090"
                    }
                ]
            },
            "RestartPolicy": {
                "Name": "unless-stopped",
                "MaximumRetryCount": 0
            },
            "AutoRemove": false,
            "VolumeDriver": "",
            "VolumesFrom": null,
            "ConsoleSize": [
                0,
                0
            ],
            "CapAdd": null,
            "CapDrop": null,
            "CgroupnsMode": "private",
            "Dns": [],
            "DnsOptions": [],
            "DnsSearch": [],
            "ExtraHosts": [],
            "GroupAdd": null,
            "IpcMode": "private",
            "Cgroup": "",
            "Links": null,
            "OomScoreAdj": 0,
            "PidMode": "",
            "Privileged": false,
            "PublishAllPorts": false,
            "ReadonlyRootfs": false,
            "SecurityOpt": [
                "no-new-privileges:true"
            ],
            "UTSMode": "",
            "UsernsMode": "",
            "ShmSize": 67108864,
            "Runtime": "runc",
            "Isolation": "",
            "CpuShares": 0,
            "Memory": 536870912,
            "NanoCpus": 500000000,
            "CgroupParent": "",
            "BlkioWeight": 0,
            "BlkioWeightDevice": null,
            "BlkioDeviceReadBps": null,
            "BlkioDeviceWriteBps": null,
            "BlkioDeviceReadIOps": null,
            "BlkioDeviceWriteIOps": null,
            "CpuPeriod": 0,
            "CpuQuota": 0,
            "CpuRealtimePeriod": 0,
            "CpuRealtimeRuntime": 0,
            "CpusetCpus": "",
            "CpusetMems": "",
            "Devices": null,
            "DeviceCgroupRules": null,
            "DeviceRequests": null,
            "MemoryReservation": 0,
            "MemorySwap": 1073741824,
            "MemorySwappiness": null,
            "OomKillDisable": null,
            "PidsLimit": null,
            "Ulimits": null,
            "CpuCount": 0,
            "CpuPercent": 0,
            "IOMaximumIOps": 0,
            "IOMaximumBandwidth": 0,
            "MaskedPaths": [
                "/proc/acpi",
                "/proc/asound",
                "/proc/interrupts",
                "/proc/kcore",
                "/proc/keys",
                "/proc/latency_stats",
                "/proc/sched_debug",
                "/proc/scsi",
                "/proc/timer_list",
                "/proc/timer_stats",
                "/sys/devices/virtual/powercap",
                "/sys/firmware"
            ],
            "ReadonlyPaths": [
                "/proc/bus",
                "/proc/fs",
                "/proc/irq",
                "/proc/sys",
                "/proc/sysrq-trigger"
            ]
        },
        "GraphDriver": {
            "Data": {
                "ID": "3fc2fc790746003750d4cc16af7cf198f6cf06440699f969fb444e9887731400",
                "LowerDir": "/var/lib/docker/overlay2/c575f43a9f420c6ad311b2d8557a14a37a885a97a4e43d237a6ac6dd8695b60b-init/diff:/var/lib/docker/overlay2/98f0c81be8bfea0ade2f832c7ad0976b07fde61840212b30b3f4e1fbfcbdcbde/diff:/var/lib/docker/overlay2/61e892d8a4a2006cb7c0213974ff0df079103b01e1536e8ee777190265b69dbe/diff:/var/lib/docker/overlay2/4911a8a7e51118b9f90e2540a3bfc4c40bd500c69f281ff71a2909c054b7447a/diff:/var/lib/docker/overlay2/c3cf1f18de8ae3db477e36cdf5077796463bc5b43dd5ffb01b8601df5ec7bf3e/diff:/var/lib/docker/overlay2/1edd4051207ca171f360ca6e0ea31772188e3ca65740ed1434ca1bcf4163e053/diff:/var/lib/docker/overlay2/e9adaaf1333808b1c886e8ee7af82915528a1c9ba8ad0d4d25213b5396274d28/diff:/var/lib/docker/overlay2/d7f8261e5c466c01b785acc5db76272af788f3faa691d88ee44ad33ef24a5dc2/diff:/var/lib/docker/overlay2/7c1e2450e0c1da396c5e1b30aa86b7d5241961c52f657eb951466a96dbeab77f/diff:/var/lib/docker/overlay2/bf54b1aaebdf74c70fdf62ad35dba474a301380c56b6e6b2aa0e9b23bb593ba7/diff:/var/lib/docker/overlay2/e38a2478114c292201a166575ab0c09c7fcc6fec56ec4f6f8b5b93c92c9949df/diff:/var/lib/docker/overlay2/135d1ac94a2cbe8065fbc86e536bc480000dbee894723516575282a77e6e69c1/diff:/var/lib/docker/overlay2/d8066357e953ea3cece4f111db8659449720a31cf38bb5e69cd36176a47b9d12/diff",
                "MergedDir": "/var/lib/docker/overlay2/c575f43a9f420c6ad311b2d8557a14a37a885a97a4e43d237a6ac6dd8695b60b/merged",
                "UpperDir": "/var/lib/docker/overlay2/c575f43a9f420c6ad311b2d8557a14a37a885a97a4e43d237a6ac6dd8695b60b/diff",
                "WorkDir": "/var/lib/docker/overlay2/c575f43a9f420c6ad311b2d8557a14a37a885a97a4e43d237a6ac6dd8695b60b/work"
            },
            "Name": "overlay2"
        },
        "Mounts": [
            {
                "Type": "bind",
                "Source": "E:\\GSentinelHealthOS\\observability\\prometheus.yml",
                "Destination": "/etc/prometheus/prometheus.yml",
                "Mode": "ro",
                "RW": false,
                "Propagation": "rprivate"
            },
            {
                "Type": "volume",
                "Name": "gsentinelhealthos_prometheus_data",
                "Source": "/var/lib/docker/volumes/gsentinelhealthos_prometheus_data/_data",
                "Destination": "/prometheus",
                "Driver": "local",
                "Mode": "rw",
                "RW": true,
                "Propagation": ""
            }
        ],
        "Config": {
            "Hostname": "3fc2fc790746",
            "Domainname": "",
            "User": "nobody",
            "AttachStdin": false,
            "AttachStdout": true,
            "AttachStderr": true,
            "ExposedPorts": {
                "9090/tcp": {}
            },
            "Tty": false,
            "OpenStdin": false,
            "StdinOnce": false,
            "Env": [
                "PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
            ],
            "Cmd": [
                "--config.file=/etc/prometheus/prometheus.yml",
                "--storage.tsdb.path=/prometheus",
                "--storage.tsdb.retention.time=15d",
                "--web.enable-lifecycle",
                "--web.console.libraries=/etc/prometheus/console_libraries",
                "--web.console.templates=/etc/prometheus/consoles"
            ],
            "Healthcheck": {
                "Test": [
                    "CMD",
                    "wget",
                    "--no-verbose",
                    "--tries=1",
                    "--spider",
                    "http://localhost:9090/-/healthy"
                ],
                "Interval": 15000000000,
                "Timeout": 5000000000,
                "Retries": 3
            },
            "Image": "prom/prometheus:v2.51.0",
            "Volumes": {
                "/prometheus": {}
            },
            "WorkingDir": "/prometheus",
            "Entrypoint": [
                "/bin/prometheus"
            ],
            "Labels": {
                "com.docker.compose.config-hash": "5396cb1e5fa5cf77eda7b6f0e8cd756d83b6b40cfea84a9ddf83d723db57baa3",
                "com.docker.compose.container-number": "1",
                "com.docker.compose.depends_on": "",
                "com.docker.compose.image": "sha256:1d3b7f56885b6dd623f1785be963aa9c195f86bc256ea454e8d02a7980b79c53",
                "com.docker.compose.oneoff": "False",
                "com.docker.compose.project": "gsentinelhealthos",
                "com.docker.compose.project.config_files": "E:\\GSentinelHealthOS\\docker-compose.yml",
                "com.docker.compose.project.working_dir": "E:\\GSentinelHealthOS",
                "com.docker.compose.service": "prometheus",
                "com.docker.compose.version": "5.1.0",
                "maintainer": "The Prometheus Authors \u003cprometheus-developers@googlegroups.com\u003e"
            },
            "StopTimeout": 1
        },
        "NetworkSettings": {
            "SandboxID": "8dcff369562c9b0d6ca6c26081c4bc81faa639104940f48d8651665b718d1b44",
            "SandboxKey": "/var/run/docker/netns/8dcff369562c",
            "Ports": {
                "9090/tcp": []
            },
            "Networks": {
                "gsentinelhealthos_gs_prod": {
                    "IPAMConfig": null,
                    "Links": null,
                    "Aliases": [
                        "gs_prometheus",
                        "prometheus"
                    ],
                    "DriverOpts": null,
                    "GwPriority": 0,
                    "NetworkID": "919bd5f232a0b0588e6ca20e3c563d7ca6731d36e1524f9f82fd1a1f698a1813",
                    "EndpointID": "ae189e8f157184b4faaaf0d3a0890e325f1cbed33f717e3920d6cf4e879d2e7b",
                    "Gateway": "172.20.0.1",
                    "IPAddress": "172.20.0.15",
                    "MacAddress": "fe:92:fa:9e:8c:76",
                    "IPPrefixLen": 16,
                    "IPv6Gateway": "",
                    "GlobalIPv6Address": "",
                    "GlobalIPv6PrefixLen": 0,
                    "DNSNames": [
                        "gs_prometheus",
                        "prometheus",
                        "3fc2fc790746"
                    ]
                }
            }
        }
    },
    {
        "Id": "ec43cd3f1a96751246c577e9f0bb4e832811a4ddac1ca170cac087814ec25a7b",
        "Created": "2026-05-16T21:19:45.228889867Z",
        "Path": "uvicorn",
        "Args": [
            "services.dialogue_engine.main:app",
            "--host",
            "0.0.0.0",
            "--port",
            "8010",
            "--workers",
            "1"
        ],
        "State": {
            "Status": "running",
            "Running": true,
            "Paused": false,
            "Restarting": false,
            "OOMKilled": false,
            "Dead": false,
            "Pid": 1550,
            "ExitCode": 0,
            "Error": "",
            "StartedAt": "2026-05-18T21:45:20.151122895Z",
            "FinishedAt": "2026-05-18T21:45:16.195246498Z",
            "Health": {
                "Status": "healthy",
                "FailingStreak": 0,
                "Log": [
                    {
                        "Start": "2026-05-19T03:09:05.336467773Z",
                        "End": "2026-05-19T03:09:05.545055947Z",
                        "ExitCode": 0,
                        "Output": ""
                    },
                    {
                        "Start": "2026-05-19T03:09:35.424488509Z",
                        "End": "2026-05-19T03:09:35.64123968Z",
                        "ExitCode": 0,
                        "Output": ""
                    },
                    {
                        "Start": "2026-05-19T03:10:05.556431446Z",
                        "End": "2026-05-19T03:10:05.693465518Z",
                        "ExitCode": 0,
                        "Output": ""
                    },
                    {
                        "Start": "2026-05-19T03:10:35.612410726Z",
                        "End": "2026-05-19T03:10:35.827594698Z",
                        "ExitCode": 0,
                        "Output": ""
                    },
                    {
                        "Start": "2026-05-19T03:11:05.744716452Z",
                        "End": "2026-05-19T03:11:05.857137502Z",
                        "ExitCode": 0,
                        "Output": ""
                    }
                ]
            }
        },
        "Image": "sha256:78f758ad1056d22d6f0cf548ccbfc73a08f61dfb761bdc65dd4caa398c5e9036",
        "ResolvConfPath": "/var/lib/docker/containers/ec43cd3f1a96751246c577e9f0bb4e832811a4ddac1ca170cac087814ec25a7b/resolv.conf",
        "HostnamePath": "/var/lib/docker/containers/ec43cd3f1a96751246c577e9f0bb4e832811a4ddac1ca170cac087814ec25a7b/hostname",
        "HostsPath": "/var/lib/docker/containers/ec43cd3f1a96751246c577e9f0bb4e832811a4ddac1ca170cac087814ec25a7b/hosts",
        "LogPath": "/var/lib/docker/containers/ec43cd3f1a96751246c577e9f0bb4e832811a4ddac1ca170cac087814ec25a7b/ec43cd3f1a96751246c577e9f0bb4e832811a4ddac1ca170cac087814ec25a7b-json.log",
        "Name": "/gs_dialogue_engine",
        "RestartCount": 0,
        "Driver": "overlay2",
        "Platform": "linux",
        "MountLabel": "",
        "ProcessLabel": "",
        "AppArmorProfile": "",
        "ExecIDs": null,
        "HostConfig": {
            "Binds": null,
            "ContainerIDFile": "",
            "LogConfig": {
                "Type": "json-file",
                "Config": {
                    "max-file": "3",
                    "max-size": "10m"
                }
            },
            "NetworkMode": "gsentinelhealthos_gs_prod",
            "PortBindings": {
                "8010/tcp": [
                    {
                        "HostIp": "127.0.0.1",
                        "HostPort": "8010"
                    }
                ]
            },
            "RestartPolicy": {
                "Name": "unless-stopped",
                "MaximumRetryCount": 0
            },
            "AutoRemove": false,
            "VolumeDriver": "",
            "VolumesFrom": null,
            "ConsoleSize": [
                0,
                0
            ],
            "CapAdd": null,
            "CapDrop": null,
            "CgroupnsMode": "private",
            "Dns": [],
            "DnsOptions": [],
            "DnsSearch": [],
            "ExtraHosts": [],
            "GroupAdd": null,
            "IpcMode": "private",
            "Cgroup": "",
            "Links": null,
            "OomScoreAdj": 0,
            "PidMode": "",
            "Privileged": false,
            "PublishAllPorts": false,
            "ReadonlyRootfs": false,
            "SecurityOpt": [
                "no-new-privileges:true"
            ],
            "UTSMode": "",
            "UsernsMode": "",
            "ShmSize": 67108864,
            "Runtime": "runc",
            "Isolation": "",
            "CpuShares": 0,
            "Memory": 536870912,
            "NanoCpus": 750000000,
            "CgroupParent": "",
            "BlkioWeight": 0,
            "BlkioWeightDevice": null,
            "BlkioDeviceReadBps": null,
            "BlkioDeviceWriteBps": null,
            "BlkioDeviceReadIOps": null,
            "BlkioDeviceWriteIOps": null,
            "CpuPeriod": 0,
            "CpuQuota": 0,
            "CpuRealtimePeriod": 0,
            "CpuRealtimeRuntime": 0,
            "CpusetCpus": "",
            "CpusetMems": "",
            "Devices": null,
            "DeviceCgroupRules": null,
            "DeviceRequests": null,
            "MemoryReservation": 0,
            "MemorySwap": 1073741824,
            "MemorySwappiness": null,
            "OomKillDisable": null,
            "PidsLimit": null,
            "Ulimits": null,
            "CpuCount": 0,
            "CpuPercent": 0,
            "IOMaximumIOps": 0,
            "IOMaximumBandwidth": 0,
            "MaskedPaths": [
                "/proc/acpi",
                "/proc/asound",
                "/proc/interrupts",
                "/proc/kcore",
                "/proc/keys",
                "/proc/latency_stats",
                "/proc/sched_debug",
                "/proc/scsi",
                "/proc/timer_list",
                "/proc/timer_stats",
                "/sys/devices/virtual/powercap",
                "/sys/firmware"
            ],
            "ReadonlyPaths": [
                "/proc/bus",
                "/proc/fs",
                "/proc/irq",
                "/proc/sys",
                "/proc/sysrq-trigger"
            ]
        },
        "GraphDriver": {
            "Data": {
                "ID": "ec43cd3f1a96751246c577e9f0bb4e832811a4ddac1ca170cac087814ec25a7b",
                "LowerDir": "/var/lib/docker/overlay2/195ca6e238860e88c6883deab90d638ab6c7b07404de3a77aabd668b46fa67fb-init/diff:/var/lib/docker/overlay2/oyyaveyr9ylq4vjaberqeuuff/diff:/var/lib/docker/overlay2/z76k7140i8nxrbqx1lad6bveh/diff:/var/lib/docker/overlay2/yfbz0i5drh70y1yvato7ng82g/diff:/var/lib/docker/overlay2/xy2hapqvl0fe8r66zfsbdqzsz/diff:/var/lib/docker/overlay2/y46vcvs8s0magh5hngaw3liou/diff:/var/lib/docker/overlay2/35paiqxwur9otdtfva4bw7ivp/diff:/var/lib/docker/overlay2/7gzj4c4dtgc88ddnhos6o0ggi/diff:/var/lib/docker/overlay2/8ed60a4496de1672027b59530d5fbb3d6d6075e2b3581b589c86502bad5229c5/diff:/var/lib/docker/overlay2/0425cc4a958c0eb91d61dbec830a422fadf41e07ba4436aa05e6246a7407bafd/diff:/var/lib/docker/overlay2/7ee8eda652e43d72c344c1e51c0405783cb68181481731c86eaf1de8abaa0950/diff:/var/lib/docker/overlay2/8fc67f38194de09b879e7b56334bffa27598204a60554a6512aabce9a84221f5/diff",
                "MergedDir": "/var/lib/docker/overlay2/195ca6e238860e88c6883deab90d638ab6c7b07404de3a77aabd668b46fa67fb/merged",
                "UpperDir": "/var/lib/docker/overlay2/195ca6e238860e88c6883deab90d638ab6c7b07404de3a77aabd668b46fa67fb/diff",
                "WorkDir": "/var/lib/docker/overlay2/195ca6e238860e88c6883deab90d638ab6c7b07404de3a77aabd668b46fa67fb/work"
            },
            "Name": "overlay2"
        },
        "Mounts": [],
        "Config": {
            "Hostname": "ec43cd3f1a96",
            "Domainname": "",
            "User": "appuser",
            "AttachStdin": false,
            "AttachStdout": true,
            "AttachStderr": true,
            "ExposedPorts": {
                "8010/tcp": {}
            },
            "Tty": false,
            "OpenStdin": false,
            "StdinOnce": false,
            "Env": [
                "LOG_LEVEL=INFO",
                "LOG_FORMAT=json",
                "REDIS_URL=redis://:bDAhxY9Af2LcR86iXN7U9gBIDpGeVuaiiKPLBTvEqLP2vbvy@redis-master:6379",
                "INTERNAL_SERVICES_KEY=INTERNAL_KEY_REDACTED",
                "ENV=production",
                "PATH=/usr/local/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
                "LANG=C.UTF-8",
                "GPG_KEY=A035C8C19219BA821ECEA86B64E628F8D684696D",
                "PYTHON_VERSION=3.11.11",
                "PYTHON_SHA256=2a9920c7a0cd236de33644ed980a13cbbc21058bfdc528febb6081575ed73be3",
                "PYTHONPATH=/app/MetaBrain",
                "PYTHONUNBUFFERED=1"
            ],
            "Cmd": [
                "uvicorn",
                "services.dialogue_engine.main:app",
                "--host",
                "0.0.0.0",
                "--port",
                "8010",
                "--workers",
                "1"
            ],
            "Healthcheck": {
                "Test": [
                    "CMD-SHELL",
                    "python -c \"import urllib.request; urllib.request.urlopen('http://localhost:8010/health')\" || exit 1"
                ],
                "Interval": 30000000000,
                "Timeout": 10000000000,
                "Retries": 3
            },
            "Image": "gsentinelhealthos-dialogue-engine",
            "Volumes": null,
            "WorkingDir": "/app",
            "Entrypoint": null,
            "Labels": {
                "com.docker.compose.config-hash": "9eb7d5b3047153d01e4cffbd35039989127b9364518949246e655e47c17d846b",
                "com.docker.compose.container-number": "1",
                "com.docker.compose.depends_on": "redis-master:service_healthy:false",
                "com.docker.compose.image": "sha256:78f758ad1056d22d6f0cf548ccbfc73a08f61dfb761bdc65dd4caa398c5e9036",
                "com.docker.compose.oneoff": "False",
                "com.docker.compose.project": "gsentinelhealthos",
                "com.docker.compose.project.config_files": "E:\\GSentinelHealthOS\\docker-compose.yml",
                "com.docker.compose.project.working_dir": "E:\\GSentinelHealthOS",
                "com.docker.compose.replace": "gs_dialogue_engine",
                "com.docker.compose.service": "dialogue-engine",
                "com.docker.compose.version": "5.1.0"
            },
            "StopTimeout": 1
        },
        "NetworkSettings": {
            "SandboxID": "4dfd65efb0519fd04ffa6ec144cce648093bc795a8d035c6336a4e4fc0f6474d",
            "SandboxKey": "/var/run/docker/netns/4dfd65efb051",
            "Ports": {
                "8010/tcp": []
            },
            "Networks": {
                "gsentinelhealthos_gs_prod": {
                    "IPAMConfig": null,
                    "Links": null,
                    "Aliases": [
                        "gs_dialogue_engine",
                        "dialogue-engine"
                    ],
                    "DriverOpts": null,
                    "GwPriority": 0,
                    "NetworkID": "919bd5f232a0b0588e6ca20e3c563d7ca6731d36e1524f9f82fd1a1f698a1813",
                    "EndpointID": "3d899b143a7c71503b1e1443e6b7905be10894a1a41f6851f99d5770aca099f4",
                    "Gateway": "172.20.0.1",
                    "IPAddress": "172.20.0.21",
                    "MacAddress": "8a:8f:ef:02:76:f4",
                    "IPPrefixLen": 16,
                    "IPv6Gateway": "",
                    "GlobalIPv6Address": "",
                    "GlobalIPv6PrefixLen": 0,
                    "DNSNames": [
                        "gs_dialogue_engine",
                        "dialogue-engine",
                        "ec43cd3f1a96"
                    ]
                }
            }
        }
    },
    {
        "Id": "ef072fa10571bce6531e15f15d821dbd54bc4e57a7f1d428cde81dafe8263b52",
        "Created": "2026-05-16T21:19:45.216707319Z",
        "Path": "python",
        "Args": [
            "-m",
            "api.app.booking_queue_worker_main"
        ],
        "State": {
            "Status": "running",
            "Running": true,
            "Paused": false,
            "Restarting": false,
            "OOMKilled": false,
            "Dead": false,
            "Pid": 1548,
            "ExitCode": 0,
            "Error": "",
            "StartedAt": "2026-05-18T21:45:20.139843402Z",
            "FinishedAt": "2026-05-18T21:45:16.195051433Z",
            "Health": {
                "Status": "healthy",
                "FailingStreak": 0,
                "Log": [
                    {
                        "Start": "2026-05-19T03:09:16.175447115Z",
                        "End": "2026-05-19T03:09:16.281434029Z",
                        "ExitCode": 0,
                        "Output": ""
                    },
                    {
                        "Start": "2026-05-19T03:09:46.160694247Z",
                        "End": "2026-05-19T03:09:46.291173061Z",
                        "ExitCode": 0,
                        "Output": ""
                    },
                    {
                        "Start": "2026-05-19T03:10:16.207422031Z",
                        "End": "2026-05-19T03:10:16.331716441Z",
                        "ExitCode": 0,
                        "Output": ""
                    },
                    {
                        "Start": "2026-05-19T03:10:46.25043352Z",
                        "End": "2026-05-19T03:10:46.342258294Z",
                        "ExitCode": 0,
                        "Output": ""
                    },
                    {
                        "Start": "2026-05-19T03:11:16.258872387Z",
                        "End": "2026-05-19T03:11:16.341301126Z",
                        "ExitCode": 0,
                        "Output": ""
                    }
                ]
            }
        },
        "Image": "sha256:472abe98d9d437ab4021a32767ff634a6472563634c0c070a3a42cc5b4ff8b81",
        "ResolvConfPath": "/var/lib/docker/containers/ef072fa10571bce6531e15f15d821dbd54bc4e57a7f1d428cde81dafe8263b52/resolv.conf",
        "HostnamePath": "/var/lib/docker/containers/ef072fa10571bce6531e15f15d821dbd54bc4e57a7f1d428cde81dafe8263b52/hostname",
        "HostsPath": "/var/lib/docker/containers/ef072fa10571bce6531e15f15d821dbd54bc4e57a7f1d428cde81dafe8263b52/hosts",
        "LogPath": "/var/lib/docker/containers/ef072fa10571bce6531e15f15d821dbd54bc4e57a7f1d428cde81dafe8263b52/ef072fa10571bce6531e15f15d821dbd54bc4e57a7f1d428cde81dafe8263b52-json.log",
        "Name": "/gs_booking_worker_1",
        "RestartCount": 0,
        "Driver": "overlay2",
        "Platform": "linux",
        "MountLabel": "",
        "ProcessLabel": "",
        "AppArmorProfile": "",
        "ExecIDs": null,
        "HostConfig": {
            "Binds": null,
            "ContainerIDFile": "",
            "LogConfig": {
                "Type": "json-file",
                "Config": {
                    "max-file": "3",
                    "max-size": "10m"
                }
            },
            "NetworkMode": "gsentinelhealthos_gs_prod",
            "PortBindings": {},
            "RestartPolicy": {
                "Name": "unless-stopped",
                "MaximumRetryCount": 0
            },
            "AutoRemove": false,
            "VolumeDriver": "",
            "VolumesFrom": null,
            "ConsoleSize": [
                0,
                0
            ],
            "CapAdd": null,
            "CapDrop": null,
            "CgroupnsMode": "private",
            "Dns": [],
            "DnsOptions": [],
            "DnsSearch": [],
            "ExtraHosts": [],
            "GroupAdd": null,
            "IpcMode": "private",
            "Cgroup": "",
            "Links": null,
            "OomScoreAdj": 0,
            "PidMode": "",
            "Privileged": false,
            "PublishAllPorts": false,
            "ReadonlyRootfs": false,
            "SecurityOpt": [
                "no-new-privileges:true"
            ],
            "UTSMode": "",
            "UsernsMode": "",
            "ShmSize": 67108864,
            "Runtime": "runc",
            "Isolation": "",
            "CpuShares": 0,
            "Memory": 536870912,
            "NanoCpus": 750000000,
            "CgroupParent": "",
            "BlkioWeight": 0,
            "BlkioWeightDevice": null,
            "BlkioDeviceReadBps": null,
            "BlkioDeviceWriteBps": null,
            "BlkioDeviceReadIOps": null,
            "BlkioDeviceWriteIOps": null,
            "CpuPeriod": 0,
            "CpuQuota": 0,
            "CpuRealtimePeriod": 0,
            "CpuRealtimeRuntime": 0,
            "CpusetCpus": "",
            "CpusetMems": "",
            "Devices": null,
            "DeviceCgroupRules": null,
            "DeviceRequests": null,
            "MemoryReservation": 0,
            "MemorySwap": 1073741824,
            "MemorySwappiness": null,
            "OomKillDisable": null,
            "PidsLimit": null,
            "Ulimits": null,
            "CpuCount": 0,
            "CpuPercent": 0,
            "IOMaximumIOps": 0,
            "IOMaximumBandwidth": 0,
            "MaskedPaths": [
                "/proc/acpi",
                "/proc/asound",
                "/proc/interrupts",
                "/proc/kcore",
                "/proc/keys",
                "/proc/latency_stats",
                "/proc/sched_debug",
                "/proc/scsi",
                "/proc/timer_list",
                "/proc/timer_stats",
                "/sys/devices/virtual/powercap",
                "/sys/firmware"
            ],
            "ReadonlyPaths": [
                "/proc/bus",
                "/proc/fs",
                "/proc/irq",
                "/proc/sys",
                "/proc/sysrq-trigger"
            ]
        },
        "GraphDriver": {
            "Data": {
                "ID": "ef072fa10571bce6531e15f15d821dbd54bc4e57a7f1d428cde81dafe8263b52",
                "LowerDir": "/var/lib/docker/overlay2/4a652af1ce5f8f00b346afc976cc8ccbe9fbd8ee069feb3249abed62775e9de0-init/diff:/var/lib/docker/overlay2/qdmb24mixe0b3rza5k9zjjxki/diff:/var/lib/docker/overlay2/kw8zge4n293p3915lhisrxhe0/diff:/var/lib/docker/overlay2/m9cngs9a259lomsq1eh6pokf8/diff:/var/lib/docker/overlay2/nnkzp2vetr044mhj9k75sblk1/diff:/var/lib/docker/overlay2/tkpkoz38yf7lenhpgvm7nr63i/diff:/var/lib/docker/overlay2/lv0yng4klel6ox1idsg5mtel1/diff:/var/lib/docker/overlay2/1obzj9gdemsnv158vq6izxc7k/diff:/var/lib/docker/overlay2/rypzowr0go2uf0k5zsxmyxbzh/diff:/var/lib/docker/overlay2/iuj2y83rrjygpry10xil67agm/diff:/var/lib/docker/overlay2/sxy0t8g1m4bl21ensdb9362ed/diff:/var/lib/docker/overlay2/s6jncavcrdrgf42sw66c5mznx/diff:/var/lib/docker/overlay2/4f7b9c6374061b0521f67b2ea884a6065bc8d3f33b52e19d235679beb19f8fb5/diff:/var/lib/docker/overlay2/adb64dddc70658da3a1d03108778fbe96f6c7d0bf7dbf5af284b8b68ebad5a4c/diff:/var/lib/docker/overlay2/6fdddc5854355954bd4e66320ec65502c5917d49bb4d289dd8fb86531fd3a21a/diff:/var/lib/docker/overlay2/198bda223fbb6b28c09d5fd3f4a601ad2f4766efb69639765edef544cb6bbb30/diff",
                "MergedDir": "/var/lib/docker/overlay2/4a652af1ce5f8f00b346afc976cc8ccbe9fbd8ee069feb3249abed62775e9de0/merged",
                "UpperDir": "/var/lib/docker/overlay2/4a652af1ce5f8f00b346afc976cc8ccbe9fbd8ee069feb3249abed62775e9de0/diff",
                "WorkDir": "/var/lib/docker/overlay2/4a652af1ce5f8f00b346afc976cc8ccbe9fbd8ee069feb3249abed62775e9de0/work"
            },
            "Name": "overlay2"
        },
        "Mounts": [],
        "Config": {
            "Hostname": "ef072fa10571",
            "Domainname": "",
            "User": "appuser",
            "AttachStdin": false,
            "AttachStdout": true,
            "AttachStderr": true,
            "Tty": false,
            "OpenStdin": false,
            "StdinOnce": false,
            "Env": [
                "BRAIN_API_KEY=BRAIN_KEY_REDACTED",
                "REDIS_SENTINELS=redis-sentinel-1:26379,redis-sentinel-2:26379,redis-sentinel-3:26379",
                "REDIS_SENTINEL_PASSWORD=bDAhxY9Af2LcR86iXN7U9gBIDpGeVuaiiKPLBTvEqLP2vbvy",
                "BOOKING_QUEUE_RESULT_TTL_SECONDS=86400",
                "LOG_LEVEL=INFO",
                "DATABASE_URL=postgresql+psycopg://sentinel:OzMTDZYpxmFNivfGStWo0kB6Xb85Uweh@db:5432/gsentinel",
                "LOG_FORMAT=json",
                "REDIS_URL=redis://:bDAhxY9Af2LcR86iXN7U9gBIDpGeVuaiiKPLBTvEqLP2vbvy@redis-master:6379",
                "BOOKING_WORKER_SHARD=1",
                "REDIS_SENTINEL_MASTER=mymaster",
                "REDIS_STATE_PREFIX=state:",
                "BOOKING_QUEUE_LOCK_TTL_MS=15000",
                "ENV=production",
                "BOOKING_QUEUE_SHARDS=2",
                "JWT_SECRET=fGd8p7xXW3FtuPco5zM4QOsHlmwgNKiJ9TrvYCEnab2Z1LqS",
                "REDIS_QUEUE_PREFIX=queue:",
                "REDIS_CACHE_PREFIX=cache:",
                "GATEWAY_API_KEY=GATEWAY_KEY_REDACTED",
                "PATH=/usr/local/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
                "LANG=C.UTF-8",
                "GPG_KEY=A035C8C19219BA821ECEA86B64E628F8D684696D",
                "PYTHON_VERSION=3.11.15",
                "PYTHON_SHA256=272179ddd9a2e41a0fc8e42e33dfbdca0b3711aa5abf372d3f2d51543d09b625"
            ],
            "Cmd": [
                "python",
                "-m",
                "api.app.booking_queue_worker_main"
            ],
            "Healthcheck": {
                "Test": [
                    "CMD-SHELL",
                    "python -c \"import socket; socket.create_connection(('db', 5432), 2).close(); socket.create_connection(('redis-master', 6379), 2).close()\""
                ],
                "Interval": 30000000000,
                "Timeout": 10000000000,
                "StartPeriod": 15000000000,
                "Retries": 3
            },
            "Image": "gsentinelhealthos-booking_worker_1",
            "Volumes": null,
            "WorkingDir": "/app",
            "Entrypoint": null,
            "Labels": {
                "com.docker.compose.config-hash": "579409d9828bf4042c0ffbd11fff92e1fee1ed527e3c35696d058e033fe49a2c",
                "com.docker.compose.container-number": "1",
                "com.docker.compose.depends_on": "redis-sentinel-1:service_healthy:false,db:service_healthy:false,redis-master:service_healthy:false",
                "com.docker.compose.image": "sha256:472abe98d9d437ab4021a32767ff634a6472563634c0c070a3a42cc5b4ff8b81",
                "com.docker.compose.oneoff": "False",
                "com.docker.compose.project": "gsentinelhealthos",
                "com.docker.compose.project.config_files": "E:\\GSentinelHealthOS\\docker-compose.yml",
                "com.docker.compose.project.working_dir": "E:\\GSentinelHealthOS",
                "com.docker.compose.replace": "gs_booking_worker_1",
                "com.docker.compose.service": "booking_worker_1",
                "com.docker.compose.version": "5.1.0"
            },
            "StopTimeout": 1
        },
        "NetworkSettings": {
            "SandboxID": "ef34abc19cb9d041275c6dc307276e0a50dce8957698db8630782c1128e72eb4",
            "SandboxKey": "/var/run/docker/netns/ef34abc19cb9",
            "Ports": {},
            "Networks": {
                "gsentinelhealthos_gs_prod": {
                    "IPAMConfig": null,
                    "Links": null,
                    "Aliases": [
                        "gs_booking_worker_1",
                        "booking_worker_1"
                    ],
                    "DriverOpts": null,
                    "GwPriority": 0,
                    "NetworkID": "919bd5f232a0b0588e6ca20e3c563d7ca6731d36e1524f9f82fd1a1f698a1813",
                    "EndpointID": "1cf29724b38f83d6a489dc92096726c8b89ec3367d82d1bac81b6d0e47e9b7c2",
                    "Gateway": "172.20.0.1",
                    "IPAddress": "172.20.0.11",
                    "MacAddress": "02:26:80:2d:f5:f0",
                    "IPPrefixLen": 16,
                    "IPv6Gateway": "",
                    "GlobalIPv6Address": "",
                    "GlobalIPv6PrefixLen": 0,
                    "DNSNames": [
                        "gs_booking_worker_1",
                        "booking_worker_1",
                        "ef072fa10571"
                    ]
                }
            }
        }
    },
    {
        "Id": "bc64a0f3495c59449cde812e78b28cdd65f6adcf226fdad410edf5ad02b44305",
        "Created": "2026-05-16T21:19:45.212959153Z",
        "Path": "uvicorn",
        "Args": [
            "services.inference_service.main:app",
            "--host",
            "0.0.0.0",
            "--port",
            "8011",
            "--workers",
            "1"
        ],
        "State": {
            "Status": "running",
            "Running": true,
            "Paused": false,
            "Restarting": false,
            "OOMKilled": false,
            "Dead": false,
            "Pid": 1478,
            "ExitCode": 0,
            "Error": "",
            "StartedAt": "2026-05-18T21:45:20.097641Z",
            "FinishedAt": "2026-05-18T21:45:16.190310823Z",
            "Health": {
                "Status": "healthy",
                "FailingStreak": 0,
                "Log": [
                    {
                        "Start": "2026-05-19T03:09:05.583857938Z",
                        "End": "2026-05-19T03:09:08.833452621Z",
                        "ExitCode": 0,
                        "Output": ""
                    },
                    {
                        "Start": "2026-05-19T03:09:38.712746894Z",
                        "End": "2026-05-19T03:09:38.853382005Z",
                        "ExitCode": 0,
                        "Output": ""
                    },
                    {
                        "Start": "2026-05-19T03:10:08.768623639Z",
                        "End": "2026-05-19T03:10:08.890432844Z",
                        "ExitCode": 0,
                        "Output": ""
                    },
                    {
                        "Start": "2026-05-19T03:10:38.809228338Z",
                        "End": "2026-05-19T03:10:38.963200772Z",
                        "ExitCode": 0,
                        "Output": ""
                    },
                    {
                        "Start": "2026-05-19T03:11:08.880429395Z",
                        "End": "2026-05-19T03:11:09.013226208Z",
                        "ExitCode": 0,
                        "Output": ""
                    }
                ]
            }
        },
        "Image": "sha256:0a4281800dcb607be4c2fb70fbdd37742bc55c8aa65304854cad0e03d5714d14",
        "ResolvConfPath": "/var/lib/docker/containers/bc64a0f3495c59449cde812e78b28cdd65f6adcf226fdad410edf5ad02b44305/resolv.conf",
        "HostnamePath": "/var/lib/docker/containers/bc64a0f3495c59449cde812e78b28cdd65f6adcf226fdad410edf5ad02b44305/hostname",
        "HostsPath": "/var/lib/docker/containers/bc64a0f3495c59449cde812e78b28cdd65f6adcf226fdad410edf5ad02b44305/hosts",
        "LogPath": "/var/lib/docker/containers/bc64a0f3495c59449cde812e78b28cdd65f6adcf226fdad410edf5ad02b44305/bc64a0f3495c59449cde812e78b28cdd65f6adcf226fdad410edf5ad02b44305-json.log",
        "Name": "/gs_inference_service",
        "RestartCount": 0,
        "Driver": "overlay2",
        "Platform": "linux",
        "MountLabel": "",
        "ProcessLabel": "",
        "AppArmorProfile": "",
        "ExecIDs": null,
        "HostConfig": {
            "Binds": null,
            "ContainerIDFile": "",
            "LogConfig": {
                "Type": "json-file",
                "Config": {
                    "max-file": "3",
                    "max-size": "10m"
                }
            },
            "NetworkMode": "gsentinelhealthos_gs_prod",
            "PortBindings": {
                "8011/tcp": [
                    {
                        "HostIp": "127.0.0.1",
                        "HostPort": "8011"
                    }
                ]
            },
            "RestartPolicy": {
                "Name": "unless-stopped",
                "MaximumRetryCount": 0
            },
            "AutoRemove": false,
            "VolumeDriver": "",
            "VolumesFrom": null,
            "ConsoleSize": [
                0,
                0
            ],
            "CapAdd": null,
            "CapDrop": null,
            "CgroupnsMode": "private",
            "Dns": [],
            "DnsOptions": [],
            "DnsSearch": [],
            "ExtraHosts": [],
            "GroupAdd": null,
            "IpcMode": "private",
            "Cgroup": "",
            "Links": null,
            "OomScoreAdj": 0,
            "PidMode": "",
            "Privileged": false,
            "PublishAllPorts": false,
            "ReadonlyRootfs": false,
            "SecurityOpt": [
                "no-new-privileges:true"
            ],
            "UTSMode": "",
            "UsernsMode": "",
            "ShmSize": 67108864,
            "Runtime": "runc",
            "Isolation": "",
            "CpuShares": 0,
            "Memory": 536870912,
            "NanoCpus": 750000000,
            "CgroupParent": "",
            "BlkioWeight": 0,
            "BlkioWeightDevice": null,
            "BlkioDeviceReadBps": null,
            "BlkioDeviceWriteBps": null,
            "BlkioDeviceReadIOps": null,
            "BlkioDeviceWriteIOps": null,
            "CpuPeriod": 0,
            "CpuQuota": 0,
            "CpuRealtimePeriod": 0,
            "CpuRealtimeRuntime": 0,
            "CpusetCpus": "",
            "CpusetMems": "",
            "Devices": null,
            "DeviceCgroupRules": null,
            "DeviceRequests": null,
            "MemoryReservation": 0,
            "MemorySwap": 1073741824,
            "MemorySwappiness": null,
            "OomKillDisable": null,
            "PidsLimit": null,
            "Ulimits": null,
            "CpuCount": 0,
            "CpuPercent": 0,
            "IOMaximumIOps": 0,
            "IOMaximumBandwidth": 0,
            "MaskedPaths": [
                "/proc/acpi",
                "/proc/asound",
                "/proc/interrupts",
                "/proc/kcore",
                "/proc/keys",
                "/proc/latency_stats",
                "/proc/sched_debug",
                "/proc/scsi",
                "/proc/timer_list",
                "/proc/timer_stats",
                "/sys/devices/virtual/powercap",
                "/sys/firmware"
            ],
            "ReadonlyPaths": [
                "/proc/bus",
                "/proc/fs",
                "/proc/irq",
                "/proc/sys",
                "/proc/sysrq-trigger"
            ]
        },
        "GraphDriver": {
            "Data": {
                "ID": "bc64a0f3495c59449cde812e78b28cdd65f6adcf226fdad410edf5ad02b44305",
                "LowerDir": "/var/lib/docker/overlay2/8c2c0abc0d9d9c1f324ecb6e1f5630219e21f9673bd34b02ae0e2428228afb30-init/diff:/var/lib/docker/overlay2/z5v19lt0ehup1d2kv67uaqvgm/diff:/var/lib/docker/overlay2/nljzoe22h5hm46awe587pybk4/diff:/var/lib/docker/overlay2/j61pyy9q1dds4t3ehhizfeg2i/diff:/var/lib/docker/overlay2/5i3bv938oxm8zlb6ylipvfino/diff:/var/lib/docker/overlay2/qqnfenxu29j2dvtyx6w2me1n5/diff:/var/lib/docker/overlay2/k268mnfckioc8rmpan93sdf9c/diff:/var/lib/docker/overlay2/35paiqxwur9otdtfva4bw7ivp/diff:/var/lib/docker/overlay2/7gzj4c4dtgc88ddnhos6o0ggi/diff:/var/lib/docker/overlay2/8ed60a4496de1672027b59530d5fbb3d6d6075e2b3581b589c86502bad5229c5/diff:/var/lib/docker/overlay2/0425cc4a958c0eb91d61dbec830a422fadf41e07ba4436aa05e6246a7407bafd/diff:/var/lib/docker/overlay2/7ee8eda652e43d72c344c1e51c0405783cb68181481731c86eaf1de8abaa0950/diff:/var/lib/docker/overlay2/8fc67f38194de09b879e7b56334bffa27598204a60554a6512aabce9a84221f5/diff",
                "MergedDir": "/var/lib/docker/overlay2/8c2c0abc0d9d9c1f324ecb6e1f5630219e21f9673bd34b02ae0e2428228afb30/merged",
                "UpperDir": "/var/lib/docker/overlay2/8c2c0abc0d9d9c1f324ecb6e1f5630219e21f9673bd34b02ae0e2428228afb30/diff",
                "WorkDir": "/var/lib/docker/overlay2/8c2c0abc0d9d9c1f324ecb6e1f5630219e21f9673bd34b02ae0e2428228afb30/work"
            },
            "Name": "overlay2"
        },
        "Mounts": [],
        "Config": {
            "Hostname": "bc64a0f3495c",
            "Domainname": "",
            "User": "appuser",
            "AttachStdin": false,
            "AttachStdout": true,
            "AttachStderr": true,
            "ExposedPorts": {
                "8011/tcp": {}
            },
            "Tty": false,
            "OpenStdin": false,
            "StdinOnce": false,
            "Env": [
                "LOG_FORMAT=json",
                "REDIS_URL=redis://:bDAhxY9Af2LcR86iXN7U9gBIDpGeVuaiiKPLBTvEqLP2vbvy@redis-master:6379",
                "INTERNAL_SERVICES_KEY=INTERNAL_KEY_REDACTED",
                "ENV=production",
                "LOG_LEVEL=INFO",
                "PATH=/usr/local/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
                "LANG=C.UTF-8",
                "GPG_KEY=A035C8C19219BA821ECEA86B64E628F8D684696D",
                "PYTHON_VERSION=3.11.11",
                "PYTHON_SHA256=2a9920c7a0cd236de33644ed980a13cbbc21058bfdc528febb6081575ed73be3",
                "PYTHONPATH=/app/MetaBrain",
                "PYTHONUNBUFFERED=1"
            ],
            "Cmd": [
                "uvicorn",
                "services.inference_service.main:app",
                "--host",
                "0.0.0.0",
                "--port",
                "8011",
                "--workers",
                "1"
            ],
            "Healthcheck": {
                "Test": [
                    "CMD-SHELL",
                    "python -c \"import urllib.request; urllib.request.urlopen('http://localhost:8011/health')\" || exit 1"
                ],
                "Interval": 30000000000,
                "Timeout": 10000000000,
                "Retries": 3
            },
            "Image": "gsentinelhealthos-inference-service",
            "Volumes": null,
            "WorkingDir": "/app",
            "Entrypoint": null,
            "Labels": {
                "com.docker.compose.config-hash": "222318c745ec030b4daddd0dd3cfe66c68f724715fb1b6c846d1961f3f4b3a3a",
                "com.docker.compose.container-number": "1",
                "com.docker.compose.depends_on": "redis-master:service_healthy:false",
                "com.docker.compose.image": "sha256:0a4281800dcb607be4c2fb70fbdd37742bc55c8aa65304854cad0e03d5714d14",
                "com.docker.compose.oneoff": "False",
                "com.docker.compose.project": "gsentinelhealthos",
                "com.docker.compose.project.config_files": "E:\\GSentinelHealthOS\\docker-compose.yml",
                "com.docker.compose.project.working_dir": "E:\\GSentinelHealthOS",
                "com.docker.compose.replace": "gs_inference_service",
                "com.docker.compose.service": "inference-service",
                "com.docker.compose.version": "5.1.0"
            },
            "StopTimeout": 1
        },
        "NetworkSettings": {
            "SandboxID": "4053b0b1a216c086bda6874563c2a7f24a6a7098afd732d076f5d647db2e36d5",
            "SandboxKey": "/var/run/docker/netns/4053b0b1a216",
            "Ports": {
                "8011/tcp": []
            },
            "Networks": {
                "gsentinelhealthos_gs_prod": {
                    "IPAMConfig": null,
                    "Links": null,
                    "Aliases": [
                        "gs_inference_service",
                        "inference-service"
                    ],
                    "DriverOpts": null,
                    "GwPriority": 0,
                    "NetworkID": "919bd5f232a0b0588e6ca20e3c563d7ca6731d36e1524f9f82fd1a1f698a1813",
                    "EndpointID": "d65d0e8c20fbbbd11a124511b2ba50102a9595399226c9e886db1d9e40205e7c",
                    "Gateway": "172.20.0.1",
                    "IPAddress": "172.20.0.19",
                    "MacAddress": "8e:ce:80:4e:3b:14",
                    "IPPrefixLen": 16,
                    "IPv6Gateway": "",
                    "GlobalIPv6Address": "",
                    "GlobalIPv6PrefixLen": 0,
                    "DNSNames": [
                        "gs_inference_service",
                        "inference-service",
                        "bc64a0f3495c"
                    ]
                }
            }
        }
    },
    {
        "Id": "90cc15f843824683dbd555eb291a999b1bbd7ba8cba4682f67bbba3381888291",
        "Created": "2026-05-16T21:19:45.208266499Z",
        "Path": "uvicorn",
        "Args": [
            "services.decision_service.main:app",
            "--host",
            "0.0.0.0",
            "--port",
            "8012",
            "--workers",
            "1"
        ],
        "State": {
            "Status": "running",
            "Running": true,
            "Paused": false,
            "Restarting": false,
            "OOMKilled": false,
            "Dead": false,
            "Pid": 1133,
            "ExitCode": 0,
            "Error": "",
            "StartedAt": "2026-05-18T21:45:20.0431144Z",
            "FinishedAt": "2026-05-18T21:45:16.194633178Z",
            "Health": {
                "Status": "healthy",
                "FailingStreak": 0,
                "Log": [
                    {
                        "Start": "2026-05-19T03:09:03.927520282Z",
                        "End": "2026-05-19T03:09:04.036070313Z",
                        "ExitCode": 0,
                        "Output": ""
                    },
                    {
                        "Start": "2026-05-19T03:09:33.91472471Z",
                        "End": "2026-05-19T03:09:34.02732736Z",
                        "ExitCode": 0,
                        "Output": ""
                    },
                    {
                        "Start": "2026-05-19T03:10:03.94331529Z",
                        "End": "2026-05-19T03:10:04.11052018Z",
                        "ExitCode": 0,
                        "Output": ""
                    },
                    {
                        "Start": "2026-05-19T03:10:34.02916164Z",
                        "End": "2026-05-19T03:10:34.153802259Z",
                        "ExitCode": 0,
                        "Output": ""
                    },
                    {
                        "Start": "2026-05-19T03:11:04.071002914Z",
                        "End": "2026-05-19T03:11:04.186853996Z",
                        "ExitCode": 0,
                        "Output": ""
                    }
                ]
            }
        },
        "Image": "sha256:0a17e788c1e98143acdfad27bdd65cf21ea1d0b15247adc35376dfdb39c6908f",
        "ResolvConfPath": "/var/lib/docker/containers/90cc15f843824683dbd555eb291a999b1bbd7ba8cba4682f67bbba3381888291/resolv.conf",
        "HostnamePath": "/var/lib/docker/containers/90cc15f843824683dbd555eb291a999b1bbd7ba8cba4682f67bbba3381888291/hostname",
        "HostsPath": "/var/lib/docker/containers/90cc15f843824683dbd555eb291a999b1bbd7ba8cba4682f67bbba3381888291/hosts",
        "LogPath": "/var/lib/docker/containers/90cc15f843824683dbd555eb291a999b1bbd7ba8cba4682f67bbba3381888291/90cc15f843824683dbd555eb291a999b1bbd7ba8cba4682f67bbba3381888291-json.log",
        "Name": "/gs_decision_service",
        "RestartCount": 0,
        "Driver": "overlay2",
        "Platform": "linux",
        "MountLabel": "",
        "ProcessLabel": "",
        "AppArmorProfile": "",
        "ExecIDs": null,
        "HostConfig": {
            "Binds": null,
            "ContainerIDFile": "",
            "LogConfig": {
                "Type": "json-file",
                "Config": {
                    "max-file": "3",
                    "max-size": "10m"
                }
            },
            "NetworkMode": "gsentinelhealthos_gs_prod",
            "PortBindings": {
                "8012/tcp": [
                    {
                        "HostIp": "127.0.0.1",
                        "HostPort": "8012"
                    }
                ]
            },
            "RestartPolicy": {
                "Name": "unless-stopped",
                "MaximumRetryCount": 0
            },
            "AutoRemove": false,
            "VolumeDriver": "",
            "VolumesFrom": null,
            "ConsoleSize": [
                0,
                0
            ],
            "CapAdd": null,
            "CapDrop": null,
            "CgroupnsMode": "private",
            "Dns": [],
            "DnsOptions": [],
            "DnsSearch": [],
            "ExtraHosts": [],
            "GroupAdd": null,
            "IpcMode": "private",
            "Cgroup": "",
            "Links": null,
            "OomScoreAdj": 0,
            "PidMode": "",
            "Privileged": false,
            "PublishAllPorts": false,
            "ReadonlyRootfs": false,
            "SecurityOpt": [
                "no-new-privileges:true"
            ],
            "UTSMode": "",
            "UsernsMode": "",
            "ShmSize": 67108864,
            "Runtime": "runc",
            "Isolation": "",
            "CpuShares": 0,
            "Memory": 536870912,
            "NanoCpus": 750000000,
            "CgroupParent": "",
            "BlkioWeight": 0,
            "BlkioWeightDevice": null,
            "BlkioDeviceReadBps": null,
            "BlkioDeviceWriteBps": null,
            "BlkioDeviceReadIOps": null,
            "BlkioDeviceWriteIOps": null,
            "CpuPeriod": 0,
            "CpuQuota": 0,
            "CpuRealtimePeriod": 0,
            "CpuRealtimeRuntime": 0,
            "CpusetCpus": "",
            "CpusetMems": "",
            "Devices": null,
            "DeviceCgroupRules": null,
            "DeviceRequests": null,
            "MemoryReservation": 0,
            "MemorySwap": 1073741824,
            "MemorySwappiness": null,
            "OomKillDisable": null,
            "PidsLimit": null,
            "Ulimits": null,
            "CpuCount": 0,
            "CpuPercent": 0,
            "IOMaximumIOps": 0,
            "IOMaximumBandwidth": 0,
            "MaskedPaths": [
                "/proc/acpi",
                "/proc/asound",
                "/proc/interrupts",
                "/proc/kcore",
                "/proc/keys",
                "/proc/latency_stats",
                "/proc/sched_debug",
                "/proc/scsi",
                "/proc/timer_list",
                "/proc/timer_stats",
                "/sys/devices/virtual/powercap",
                "/sys/firmware"
            ],
            "ReadonlyPaths": [
                "/proc/bus",
                "/proc/fs",
                "/proc/irq",
                "/proc/sys",
                "/proc/sysrq-trigger"
            ]
        },
        "GraphDriver": {
            "Data": {
                "ID": "90cc15f843824683dbd555eb291a999b1bbd7ba8cba4682f67bbba3381888291",
                "LowerDir": "/var/lib/docker/overlay2/8002bc05963e2959d405f1346730332c8e5f3a01e8925042cf0c3070c34b49f3-init/diff:/var/lib/docker/overlay2/xjgh7i18iawgn0uxn8wftn3mh/diff:/var/lib/docker/overlay2/hdql5lu0btoamkups0t2uctmz/diff:/var/lib/docker/overlay2/kydan5lqsr8l8tavgh7jj0i0z/diff:/var/lib/docker/overlay2/xy2hapqvl0fe8r66zfsbdqzsz/diff:/var/lib/docker/overlay2/y46vcvs8s0magh5hngaw3liou/diff:/var/lib/docker/overlay2/35paiqxwur9otdtfva4bw7ivp/diff:/var/lib/docker/overlay2/7gzj4c4dtgc88ddnhos6o0ggi/diff:/var/lib/docker/overlay2/8ed60a4496de1672027b59530d5fbb3d6d6075e2b3581b589c86502bad5229c5/diff:/var/lib/docker/overlay2/0425cc4a958c0eb91d61dbec830a422fadf41e07ba4436aa05e6246a7407bafd/diff:/var/lib/docker/overlay2/7ee8eda652e43d72c344c1e51c0405783cb68181481731c86eaf1de8abaa0950/diff:/var/lib/docker/overlay2/8fc67f38194de09b879e7b56334bffa27598204a60554a6512aabce9a84221f5/diff",
                "MergedDir": "/var/lib/docker/overlay2/8002bc05963e2959d405f1346730332c8e5f3a01e8925042cf0c3070c34b49f3/merged",
                "UpperDir": "/var/lib/docker/overlay2/8002bc05963e2959d405f1346730332c8e5f3a01e8925042cf0c3070c34b49f3/diff",
                "WorkDir": "/var/lib/docker/overlay2/8002bc05963e2959d405f1346730332c8e5f3a01e8925042cf0c3070c34b49f3/work"
            },
            "Name": "overlay2"
        },
        "Mounts": [],
        "Config": {
            "Hostname": "90cc15f84382",
            "Domainname": "",
            "User": "appuser",
            "AttachStdin": false,
            "AttachStdout": true,
            "AttachStderr": true,
            "ExposedPorts": {
                "8012/tcp": {}
            },
            "Tty": false,
            "OpenStdin": false,
            "StdinOnce": false,
            "Env": [
                "LOG_LEVEL=INFO",
                "LOG_FORMAT=json",
                "REDIS_URL=redis://:bDAhxY9Af2LcR86iXN7U9gBIDpGeVuaiiKPLBTvEqLP2vbvy@redis-master:6379",
                "INTERNAL_SERVICES_KEY=INTERNAL_KEY_REDACTED",
                "ENV=production",
                "PATH=/usr/local/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
                "LANG=C.UTF-8",
                "GPG_KEY=A035C8C19219BA821ECEA86B64E628F8D684696D",
                "PYTHON_VERSION=3.11.11",
                "PYTHON_SHA256=2a9920c7a0cd236de33644ed980a13cbbc21058bfdc528febb6081575ed73be3",
                "PYTHONPATH=/app/MetaBrain",
                "PYTHONUNBUFFERED=1"
            ],
            "Cmd": [
                "uvicorn",
                "services.decision_service.main:app",
                "--host",
                "0.0.0.0",
                "--port",
                "8012",
                "--workers",
                "1"
            ],
            "Healthcheck": {
                "Test": [
                    "CMD-SHELL",
                    "python -c \"import urllib.request; urllib.request.urlopen('http://localhost:8012/health')\" || exit 1"
                ],
                "Interval": 30000000000,
                "Timeout": 10000000000,
                "Retries": 3
            },
            "Image": "gsentinelhealthos-decision-service",
            "Volumes": null,
            "WorkingDir": "/app",
            "Entrypoint": null,
            "Labels": {
                "com.docker.compose.config-hash": "25c8dae6b677c8571c4bcd29beb6e5e772b0c5572b8b53851d0cc8dde3f44f18",
                "com.docker.compose.container-number": "1",
                "com.docker.compose.depends_on": "redis-master:service_healthy:false",
                "com.docker.compose.image": "sha256:0a17e788c1e98143acdfad27bdd65cf21ea1d0b15247adc35376dfdb39c6908f",
                "com.docker.compose.oneoff": "False",
                "com.docker.compose.project": "gsentinelhealthos",
                "com.docker.compose.project.config_files": "E:\\GSentinelHealthOS\\docker-compose.yml",
                "com.docker.compose.project.working_dir": "E:\\GSentinelHealthOS",
                "com.docker.compose.replace": "gs_decision_service",
                "com.docker.compose.service": "decision-service",
                "com.docker.compose.version": "5.1.0"
            },
            "StopTimeout": 1
        },
        "NetworkSettings": {
            "SandboxID": "88dcb969c31bb8a56d3d1dbe2f91cc2b2a2e91f9ee4d3b052c33ebd7486bc330",
            "SandboxKey": "/var/run/docker/netns/88dcb969c31b",
            "Ports": {
                "8012/tcp": []
            },
            "Networks": {
                "gsentinelhealthos_gs_prod": {
                    "IPAMConfig": null,
                    "Links": null,
                    "Aliases": [
                        "gs_decision_service",
                        "decision-service"
                    ],
                    "DriverOpts": null,
                    "GwPriority": 0,
                    "NetworkID": "919bd5f232a0b0588e6ca20e3c563d7ca6731d36e1524f9f82fd1a1f698a1813",
                    "EndpointID": "7e53da0448512eff96e6635e3ff191609cb967ead381cb3852eda278de135abd",
                    "Gateway": "172.20.0.1",
                    "IPAddress": "172.20.0.7",
                    "MacAddress": "66:41:7e:9a:f4:30",
                    "IPPrefixLen": 16,
                    "IPv6Gateway": "",
                    "GlobalIPv6Address": "",
                    "GlobalIPv6PrefixLen": 0,
                    "DNSNames": [
                        "gs_decision_service",
                        "decision-service",
                        "90cc15f84382"
                    ]
                }
            }
        }
    },
    {
        "Id": "9bfdc91c334defd33bda86b68eaaef756d4bcb653a82705da16e09df2bcef999",
        "Created": "2026-05-16T21:19:45.204943722Z",
        "Path": "python",
        "Args": [
            "-m",
            "api.app.booking_queue_worker_main"
        ],
        "State": {
            "Status": "running",
            "Running": true,
            "Paused": false,
            "Restarting": false,
            "OOMKilled": false,
            "Dead": false,
            "Pid": 1052,
            "ExitCode": 0,
            "Error": "",
            "StartedAt": "2026-05-18T21:45:20.026903387Z",
            "FinishedAt": "2026-05-18T21:45:16.190385038Z",
            "Health": {
                "Status": "healthy",
                "FailingStreak": 0,
                "Log": [
                    {
                        "Start": "2026-05-19T03:09:14.091110185Z",
                        "End": "2026-05-19T03:09:14.18177457Z",
                        "ExitCode": 0,
                        "Output": ""
                    },
                    {
                        "Start": "2026-05-19T03:09:44.061485509Z",
                        "End": "2026-05-19T03:09:44.165617531Z",
                        "ExitCode": 0,
                        "Output": ""
                    },
                    {
                        "Start": "2026-05-19T03:10:14.080823207Z",
                        "End": "2026-05-19T03:10:14.168040156Z",
                        "ExitCode": 0,
                        "Output": ""
                    },
                    {
                        "Start": "2026-05-19T03:10:44.087229409Z",
                        "End": "2026-05-19T03:10:44.170379787Z",
                        "ExitCode": 0,
                        "Output": ""
                    },
                    {
                        "Start": "2026-05-19T03:11:14.087152272Z",
                        "End": "2026-05-19T03:11:14.183346781Z",
                        "ExitCode": 0,
                        "Output": ""
                    }
                ]
            }
        },
        "Image": "sha256:78ad8bc25f175d4fc0851ebcfd81d8eb401acd14f5cad993102a3706b3e861c1",
        "ResolvConfPath": "/var/lib/docker/containers/9bfdc91c334defd33bda86b68eaaef756d4bcb653a82705da16e09df2bcef999/resolv.conf",
        "HostnamePath": "/var/lib/docker/containers/9bfdc91c334defd33bda86b68eaaef756d4bcb653a82705da16e09df2bcef999/hostname",
        "HostsPath": "/var/lib/docker/containers/9bfdc91c334defd33bda86b68eaaef756d4bcb653a82705da16e09df2bcef999/hosts",
        "LogPath": "/var/lib/docker/containers/9bfdc91c334defd33bda86b68eaaef756d4bcb653a82705da16e09df2bcef999/9bfdc91c334defd33bda86b68eaaef756d4bcb653a82705da16e09df2bcef999-json.log",
        "Name": "/gs_booking_worker_0",
        "RestartCount": 0,
        "Driver": "overlay2",
        "Platform": "linux",
        "MountLabel": "",
        "ProcessLabel": "",
        "AppArmorProfile": "",
        "ExecIDs": null,
        "HostConfig": {
            "Binds": null,
            "ContainerIDFile": "",
            "LogConfig": {
                "Type": "json-file",
                "Config": {
                    "max-file": "3",
                    "max-size": "10m"
                }
            },
            "NetworkMode": "gsentinelhealthos_gs_prod",
            "PortBindings": {},
            "RestartPolicy": {
                "Name": "unless-stopped",
                "MaximumRetryCount": 0
            },
            "AutoRemove": false,
            "VolumeDriver": "",
            "VolumesFrom": null,
            "ConsoleSize": [
                0,
                0
            ],
            "CapAdd": null,
            "CapDrop": null,
            "CgroupnsMode": "private",
            "Dns": [],
            "DnsOptions": [],
            "DnsSearch": [],
            "ExtraHosts": [],
            "GroupAdd": null,
            "IpcMode": "private",
            "Cgroup": "",
            "Links": null,
            "OomScoreAdj": 0,
            "PidMode": "",
            "Privileged": false,
            "PublishAllPorts": false,
            "ReadonlyRootfs": false,
            "SecurityOpt": [
                "no-new-privileges:true"
            ],
            "UTSMode": "",
            "UsernsMode": "",
            "ShmSize": 67108864,
            "Runtime": "runc",
            "Isolation": "",
            "CpuShares": 0,
            "Memory": 536870912,
            "NanoCpus": 750000000,
            "CgroupParent": "",
            "BlkioWeight": 0,
            "BlkioWeightDevice": null,
            "BlkioDeviceReadBps": null,
            "BlkioDeviceWriteBps": null,
            "BlkioDeviceReadIOps": null,
            "BlkioDeviceWriteIOps": null,
            "CpuPeriod": 0,
            "CpuQuota": 0,
            "CpuRealtimePeriod": 0,
            "CpuRealtimeRuntime": 0,
            "CpusetCpus": "",
            "CpusetMems": "",
            "Devices": null,
            "DeviceCgroupRules": null,
            "DeviceRequests": null,
            "MemoryReservation": 0,
            "MemorySwap": 1073741824,
            "MemorySwappiness": null,
            "OomKillDisable": null,
            "PidsLimit": null,
            "Ulimits": null,
            "CpuCount": 0,
            "CpuPercent": 0,
            "IOMaximumIOps": 0,
            "IOMaximumBandwidth": 0,
            "MaskedPaths": [
                "/proc/acpi",
                "/proc/asound",
                "/proc/interrupts",
                "/proc/kcore",
                "/proc/keys",
                "/proc/latency_stats",
                "/proc/sched_debug",
                "/proc/scsi",
                "/proc/timer_list",
                "/proc/timer_stats",
                "/sys/devices/virtual/powercap",
                "/sys/firmware"
            ],
            "ReadonlyPaths": [
                "/proc/bus",
                "/proc/fs",
                "/proc/irq",
                "/proc/sys",
                "/proc/sysrq-trigger"
            ]
        },
        "GraphDriver": {
            "Data": {
                "ID": "9bfdc91c334defd33bda86b68eaaef756d4bcb653a82705da16e09df2bcef999",
                "LowerDir": "/var/lib/docker/overlay2/c2b5dfc7aec53ae930d2570580efd82423df36c969f573c4da98d00b25ae9f42-init/diff:/var/lib/docker/overlay2/qdmb24mixe0b3rza5k9zjjxki/diff:/var/lib/docker/overlay2/kw8zge4n293p3915lhisrxhe0/diff:/var/lib/docker/overlay2/m9cngs9a259lomsq1eh6pokf8/diff:/var/lib/docker/overlay2/nnkzp2vetr044mhj9k75sblk1/diff:/var/lib/docker/overlay2/tkpkoz38yf7lenhpgvm7nr63i/diff:/var/lib/docker/overlay2/lv0yng4klel6ox1idsg5mtel1/diff:/var/lib/docker/overlay2/1obzj9gdemsnv158vq6izxc7k/diff:/var/lib/docker/overlay2/rypzowr0go2uf0k5zsxmyxbzh/diff:/var/lib/docker/overlay2/iuj2y83rrjygpry10xil67agm/diff:/var/lib/docker/overlay2/sxy0t8g1m4bl21ensdb9362ed/diff:/var/lib/docker/overlay2/s6jncavcrdrgf42sw66c5mznx/diff:/var/lib/docker/overlay2/4f7b9c6374061b0521f67b2ea884a6065bc8d3f33b52e19d235679beb19f8fb5/diff:/var/lib/docker/overlay2/adb64dddc70658da3a1d03108778fbe96f6c7d0bf7dbf5af284b8b68ebad5a4c/diff:/var/lib/docker/overlay2/6fdddc5854355954bd4e66320ec65502c5917d49bb4d289dd8fb86531fd3a21a/diff:/var/lib/docker/overlay2/198bda223fbb6b28c09d5fd3f4a601ad2f4766efb69639765edef544cb6bbb30/diff",
                "MergedDir": "/var/lib/docker/overlay2/c2b5dfc7aec53ae930d2570580efd82423df36c969f573c4da98d00b25ae9f42/merged",
                "UpperDir": "/var/lib/docker/overlay2/c2b5dfc7aec53ae930d2570580efd82423df36c969f573c4da98d00b25ae9f42/diff",
                "WorkDir": "/var/lib/docker/overlay2/c2b5dfc7aec53ae930d2570580efd82423df36c969f573c4da98d00b25ae9f42/work"
            },
            "Name": "overlay2"
        },
        "Mounts": [],
        "Config": {
            "Hostname": "9bfdc91c334d",
            "Domainname": "",
            "User": "appuser",
            "AttachStdin": false,
            "AttachStdout": true,
            "AttachStderr": true,
            "Tty": false,
            "OpenStdin": false,
            "StdinOnce": false,
            "Env": [
                "DATABASE_URL=postgresql+psycopg://sentinel:OzMTDZYpxmFNivfGStWo0kB6Xb85Uweh@db:5432/gsentinel",
                "REDIS_STATE_PREFIX=state:",
                "BOOKING_QUEUE_LOCK_TTL_MS=15000",
                "REDIS_SENTINEL_PASSWORD=bDAhxY9Af2LcR86iXN7U9gBIDpGeVuaiiKPLBTvEqLP2vbvy",
                "BRAIN_API_KEY=BRAIN_KEY_REDACTED",
                "LOG_FORMAT=json",
                "REDIS_CACHE_PREFIX=cache:",
                "LOG_LEVEL=INFO",
                "BOOKING_QUEUE_SHARDS=2",
                "GATEWAY_API_KEY=GATEWAY_KEY_REDACTED",
                "REDIS_URL=redis://:bDAhxY9Af2LcR86iXN7U9gBIDpGeVuaiiKPLBTvEqLP2vbvy@redis-master:6379",
                "JWT_SECRET=fGd8p7xXW3FtuPco5zM4QOsHlmwgNKiJ9TrvYCEnab2Z1LqS",
                "BOOKING_QUEUE_RESULT_TTL_SECONDS=86400",
                "BOOKING_WORKER_SHARD=0",
                "REDIS_QUEUE_PREFIX=queue:",
                "REDIS_SENTINEL_MASTER=mymaster",
                "ENV=production",
                "REDIS_SENTINELS=redis-sentinel-1:26379,redis-sentinel-2:26379,redis-sentinel-3:26379",
                "PATH=/usr/local/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
                "LANG=C.UTF-8",
                "GPG_KEY=A035C8C19219BA821ECEA86B64E628F8D684696D",
                "PYTHON_VERSION=3.11.15",
                "PYTHON_SHA256=272179ddd9a2e41a0fc8e42e33dfbdca0b3711aa5abf372d3f2d51543d09b625"
            ],
            "Cmd": [
                "python",
                "-m",
                "api.app.booking_queue_worker_main"
            ],
            "Healthcheck": {
                "Test": [
                    "CMD-SHELL",
                    "python -c \"import socket; socket.create_connection(('db', 5432), 2).close(); socket.create_connection(('redis-master', 6379), 2).close()\""
                ],
                "Interval": 30000000000,
                "Timeout": 10000000000,
                "StartPeriod": 15000000000,
                "Retries": 3
            },
            "Image": "gsentinelhealthos-booking_worker_0",
            "Volumes": null,
            "WorkingDir": "/app",
            "Entrypoint": null,
            "Labels": {
                "com.docker.compose.config-hash": "d6e29195868022eb4b35366cc0707c97ff579b0d694731a042a16813c195d4f0",
                "com.docker.compose.container-number": "1",
                "com.docker.compose.depends_on": "redis-master:service_healthy:false,redis-sentinel-1:service_healthy:false,db:service_healthy:false",
                "com.docker.compose.image": "sha256:78ad8bc25f175d4fc0851ebcfd81d8eb401acd14f5cad993102a3706b3e861c1",
                "com.docker.compose.oneoff": "False",
                "com.docker.compose.project": "gsentinelhealthos",
                "com.docker.compose.project.config_files": "E:\\GSentinelHealthOS\\docker-compose.yml",
                "com.docker.compose.project.working_dir": "E:\\GSentinelHealthOS",
                "com.docker.compose.replace": "gs_booking_worker_0",
                "com.docker.compose.service": "booking_worker_0",
                "com.docker.compose.version": "5.1.0"
            },
            "StopTimeout": 1
        },
        "NetworkSettings": {
            "SandboxID": "3e513772cc9a166daef1c24cf19e0ea48995085606af50281bd9d03da996002f",
            "SandboxKey": "/var/run/docker/netns/3e513772cc9a",
            "Ports": {},
            "Networks": {
                "gsentinelhealthos_gs_prod": {
                    "IPAMConfig": null,
                    "Links": null,
                    "Aliases": [
                        "gs_booking_worker_0",
                        "booking_worker_0"
                    ],
                    "DriverOpts": null,
                    "GwPriority": 0,
                    "NetworkID": "919bd5f232a0b0588e6ca20e3c563d7ca6731d36e1524f9f82fd1a1f698a1813",
                    "EndpointID": "fcf85f5507bd94f6379188a19f7d600294c5592802593bffea170756035df6d6",
                    "Gateway": "172.20.0.1",
                    "IPAddress": "172.20.0.3",
                    "MacAddress": "e2:b0:4e:89:73:57",
                    "IPPrefixLen": 16,
                    "IPv6Gateway": "",
                    "GlobalIPv6Address": "",
                    "GlobalIPv6PrefixLen": 0,
                    "DNSNames": [
                        "gs_booking_worker_0",
                        "booking_worker_0",
                        "9bfdc91c334d"
                    ]
                }
            }
        }
    },
    {
        "Id": "9c4d8a95d77fa6f46a7740dae1939baa173d2c4b4b092427fd9229f28d6df2b8",
        "Created": "2026-05-16T19:30:17.337024236Z",
        "Path": "docker-entrypoint.sh",
        "Args": [
            "sh",
            "-c",
            "cp /usr/local/etc/redis/sentinel.conf /tmp/sentinel.conf \u0026\u0026 printf '\nsentinel auth-pass mymaster %s\n' \"$REDIS_PASSWORD\" \u003e\u003e /tmp/sentinel.conf \u0026\u0026 redis-server /tmp/sentinel.conf --sentinel"
        ],
        "State": {
            "Status": "running",
            "Running": true,
            "Paused": false,
            "Restarting": false,
            "OOMKilled": false,
            "Dead": false,
            "Pid": 1266,
            "ExitCode": 0,
            "Error": "",
            "StartedAt": "2026-05-18T21:45:20.070069012Z",
            "FinishedAt": "2026-05-18T21:45:16.195280269Z",
            "Health": {
                "Status": "healthy",
                "FailingStreak": 0,
                "Log": [
                    {
                        "Start": "2026-05-19T03:10:38.394695366Z",
                        "End": "2026-05-19T03:10:38.504228608Z",
                        "ExitCode": 0,
                        "Output": "Warning: Using a password with '-a' or '-u' option on the command line interface may not be safe.\nAUTH failed: ERR AUTH \u003cpassword\u003e called without any password configured for the default user. Are you sure your configuration is correct?\nPONG\n"
                    },
                    {
                        "Start": "2026-05-19T03:10:48.505263802Z",
                        "End": "2026-05-19T03:10:48.607285763Z",
                        "ExitCode": 0,
                        "Output": "Warning: Using a password with '-a' or '-u' option on the command line interface may not be safe.\nAUTH failed: ERR AUTH \u003cpassword\u003e called without any password configured for the default user. Are you sure your configuration is correct?\nPONG\n"
                    },
                    {
                        "Start": "2026-05-19T03:10:58.524676759Z",
                        "End": "2026-05-19T03:10:58.621294489Z",
                        "ExitCode": 0,
                        "Output": "Warning: Using a password with '-a' or '-u' option on the command line interface may not be safe.\nAUTH failed: ERR AUTH \u003cpassword\u003e called without any password configured for the default user. Are you sure your configuration is correct?\nPONG\n"
                    },
                    {
                        "Start": "2026-05-19T03:11:08.622193872Z",
                        "End": "2026-05-19T03:11:08.681197767Z",
                        "ExitCode": 0,
                        "Output": "Warning: Using a password with '-a' or '-u' option on the command line interface may not be safe.\nAUTH failed: ERR AUTH \u003cpassword\u003e called without any password configured for the default user. Are you sure your configuration is correct?\nPONG\n"
                    },
                    {
                        "Start": "2026-05-19T03:11:18.682685491Z",
                        "End": "2026-05-19T03:11:18.746165609Z",
                        "ExitCode": 0,
                        "Output": "Warning: Using a password with '-a' or '-u' option on the command line interface may not be safe.\nAUTH failed: ERR AUTH \u003cpassword\u003e called without any password configured for the default user. Are you sure your configuration is correct?\nPONG\n"
                    }
                ]
            }
        },
        "Image": "sha256:e74faa347ab0b6a3c1b040834a35ea5f20e3aa02460db4bb9d5b4685f3dd3baf",
        "ResolvConfPath": "/var/lib/docker/containers/9c4d8a95d77fa6f46a7740dae1939baa173d2c4b4b092427fd9229f28d6df2b8/resolv.conf",
        "HostnamePath": "/var/lib/docker/containers/9c4d8a95d77fa6f46a7740dae1939baa173d2c4b4b092427fd9229f28d6df2b8/hostname",
        "HostsPath": "/var/lib/docker/containers/9c4d8a95d77fa6f46a7740dae1939baa173d2c4b4b092427fd9229f28d6df2b8/hosts",
        "LogPath": "/var/lib/docker/containers/9c4d8a95d77fa6f46a7740dae1939baa173d2c4b4b092427fd9229f28d6df2b8/9c4d8a95d77fa6f46a7740dae1939baa173d2c4b4b092427fd9229f28d6df2b8-json.log",
        "Name": "/gs_redis_sentinel_2",
        "RestartCount": 0,
        "Driver": "overlay2",
        "Platform": "linux",
        "MountLabel": "",
        "ProcessLabel": "",
        "AppArmorProfile": "",
        "ExecIDs": null,
        "HostConfig": {
            "Binds": [
                "E:\\GSentinelHealthOS\\broker\\sentinel.conf:/usr/local/etc/redis/sentinel.conf:ro"
            ],
            "ContainerIDFile": "",
            "LogConfig": {
                "Type": "json-file",
                "Config": {
                    "max-file": "2",
                    "max-size": "5m"
                }
            },
            "NetworkMode": "gsentinelhealthos_gs_prod",
            "PortBindings": {},
            "RestartPolicy": {
                "Name": "unless-stopped",
                "MaximumRetryCount": 0
            },
            "AutoRemove": false,
            "VolumeDriver": "",
            "VolumesFrom": null,
            "ConsoleSize": [
                0,
                0
            ],
            "CapAdd": null,
            "CapDrop": null,
            "CgroupnsMode": "private",
            "Dns": [],
            "DnsOptions": [],
            "DnsSearch": [],
            "ExtraHosts": [],
            "GroupAdd": null,
            "IpcMode": "private",
            "Cgroup": "",
            "Links": null,
            "OomScoreAdj": 0,
            "PidMode": "",
            "Privileged": false,
            "PublishAllPorts": false,
            "ReadonlyRootfs": false,
            "SecurityOpt": [
                "no-new-privileges:true"
            ],
            "UTSMode": "",
            "UsernsMode": "",
            "ShmSize": 67108864,
            "Runtime": "runc",
            "Isolation": "",
            "CpuShares": 0,
            "Memory": 134217728,
            "NanoCpus": 250000000,
            "CgroupParent": "",
            "BlkioWeight": 0,
            "BlkioWeightDevice": null,
            "BlkioDeviceReadBps": null,
            "BlkioDeviceWriteBps": null,
            "BlkioDeviceReadIOps": null,
            "BlkioDeviceWriteIOps": null,
            "CpuPeriod": 0,
            "CpuQuota": 0,
            "CpuRealtimePeriod": 0,
            "CpuRealtimeRuntime": 0,
            "CpusetCpus": "",
            "CpusetMems": "",
            "Devices": null,
            "DeviceCgroupRules": null,
            "DeviceRequests": null,
            "MemoryReservation": 0,
            "MemorySwap": 268435456,
            "MemorySwappiness": null,
            "OomKillDisable": null,
            "PidsLimit": null,
            "Ulimits": null,
            "CpuCount": 0,
            "CpuPercent": 0,
            "IOMaximumIOps": 0,
            "IOMaximumBandwidth": 0,
            "Mounts": [
                {
                    "Type": "volume",
                    "Source": "d6e03b8abee05a2a5f74fe3b6ff21f7886e736c2fbdaddf0220e04c8995aac6a",
                    "Target": "/data"
                }
            ],
            "MaskedPaths": [
                "/proc/acpi",
                "/proc/asound",
                "/proc/interrupts",
                "/proc/kcore",
                "/proc/keys",
                "/proc/latency_stats",
                "/proc/sched_debug",
                "/proc/scsi",
                "/proc/timer_list",
                "/proc/timer_stats",
                "/sys/devices/virtual/powercap",
                "/sys/firmware"
            ],
            "ReadonlyPaths": [
                "/proc/bus",
                "/proc/fs",
                "/proc/irq",
                "/proc/sys",
                "/proc/sysrq-trigger"
            ]
        },
        "GraphDriver": {
            "Data": {
                "ID": "9c4d8a95d77fa6f46a7740dae1939baa173d2c4b4b092427fd9229f28d6df2b8",
                "LowerDir": "/var/lib/docker/overlay2/816335feeeca482e4f4343335404a242ce0637d738a646cb7a094f5454400cc0-init/diff:/var/lib/docker/overlay2/8c9090380150b4636f6319b5c2b8adc07efaca5df68e948e6418fd36c142f49d/diff:/var/lib/docker/overlay2/e85f396d82ffc5d990826d062fe059185779692ff70111fe596efb62c2876923/diff:/var/lib/docker/overlay2/8cca02262c9f2436236c122d7e63eba78ab4be5b77971c372934efcb7bf5bdf1/diff:/var/lib/docker/overlay2/7267c3d380a80502ea27c1cf22254c597730fa6f0bf94e8b9fcb6dd189c771a1/diff:/var/lib/docker/overlay2/6de7058bf8829c0201fb6b07e6f1b2b08c8be1068e686abc36ee6a8175fd320f/diff:/var/lib/docker/overlay2/4f0da3802045cf986cc9b74d1eeb229e70ab60670cef9f9fbd9b6a77ae4c0ea2/diff:/var/lib/docker/overlay2/fccffb1cd9ddd708bbb163c23a68583fc17fda15258ccaf798f28f97bbe2319d/diff",
                "MergedDir": "/var/lib/docker/overlay2/816335feeeca482e4f4343335404a242ce0637d738a646cb7a094f5454400cc0/merged",
                "UpperDir": "/var/lib/docker/overlay2/816335feeeca482e4f4343335404a242ce0637d738a646cb7a094f5454400cc0/diff",
                "WorkDir": "/var/lib/docker/overlay2/816335feeeca482e4f4343335404a242ce0637d738a646cb7a094f5454400cc0/work"
            },
            "Name": "overlay2"
        },
        "Mounts": [
            {
                "Type": "volume",
                "Name": "d6e03b8abee05a2a5f74fe3b6ff21f7886e736c2fbdaddf0220e04c8995aac6a",
                "Source": "/var/lib/docker/volumes/d6e03b8abee05a2a5f74fe3b6ff21f7886e736c2fbdaddf0220e04c8995aac6a/_data",
                "Destination": "/data",
                "Driver": "local",
                "Mode": "z",
                "RW": true,
                "Propagation": ""
            },
            {
                "Type": "bind",
                "Source": "E:\\GSentinelHealthOS\\broker\\sentinel.conf",
                "Destination": "/usr/local/etc/redis/sentinel.conf",
                "Mode": "ro",
                "RW": false,
                "Propagation": "rprivate"
            }
        ],
        "Config": {
            "Hostname": "9c4d8a95d77f",
            "Domainname": "",
            "User": "",
            "AttachStdin": false,
            "AttachStdout": true,
            "AttachStderr": true,
            "ExposedPorts": {
                "6379/tcp": {}
            },
            "Tty": false,
            "OpenStdin": false,
            "StdinOnce": false,
            "Env": [
                "REDIS_PASSWORD=bDAhxY9Af2LcR86iXN7U9gBIDpGeVuaiiKPLBTvEqLP2vbvy",
                "PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
                "REDIS_DOWNLOAD_URL=https://github.com/redis/redis/archive/refs/tags/8.0.2.tar.gz",
                "REDIS_DOWNLOAD_SHA=caf3c0069f06fc84c5153bd2a348b204c578de80490c73857bee01d9b5d7401f"
            ],
            "Cmd": [
                "sh",
                "-c",
                "cp /usr/local/etc/redis/sentinel.conf /tmp/sentinel.conf \u0026\u0026 printf '\nsentinel auth-pass mymaster %s\n' \"$REDIS_PASSWORD\" \u003e\u003e /tmp/sentinel.conf \u0026\u0026 redis-server /tmp/sentinel.conf --sentinel"
            ],
            "Healthcheck": {
                "Test": [
                    "CMD",
                    "sh",
                    "-c",
                    "redis-cli -h localhost -p 26379 -a \"$REDIS_PASSWORD\" ping"
                ],
                "Interval": 10000000000,
                "Timeout": 3000000000,
                "Retries": 5
            },
            "Image": "redis:8.0.2-alpine",
            "Volumes": {
                "/data": {}
            },
            "WorkingDir": "/data",
            "Entrypoint": [
                "docker-entrypoint.sh"
            ],
            "Labels": {
                "com.docker.compose.config-hash": "74f0392af84b6866450d8e24169590c160a3370303121355cf2d3892265ae20b",
                "com.docker.compose.container-number": "1",
                "com.docker.compose.depends_on": "redis-master:service_healthy:false,redis-replica:service_healthy:false",
                "com.docker.compose.image": "sha256:e74faa347ab0b6a3c1b040834a35ea5f20e3aa02460db4bb9d5b4685f3dd3baf",
                "com.docker.compose.oneoff": "False",
                "com.docker.compose.project": "gsentinelhealthos",
                "com.docker.compose.project.config_files": "E:\\GSentinelHealthOS\\docker-compose.yml",
                "com.docker.compose.project.working_dir": "E:\\GSentinelHealthOS",
                "com.docker.compose.replace": "gs_redis_sentinel_2",
                "com.docker.compose.service": "redis-sentinel-2",
                "com.docker.compose.version": "5.1.0"
            },
            "StopTimeout": 1
        },
        "NetworkSettings": {
            "SandboxID": "0b64a7a2e27302c937918b7c6f10bcb92c88fc902eee8825e8788c8316110d82",
            "SandboxKey": "/var/run/docker/netns/0b64a7a2e273",
            "Ports": {
                "6379/tcp": null
            },
            "Networks": {
                "gsentinelhealthos_gs_prod": {
                    "IPAMConfig": null,
                    "Links": null,
                    "Aliases": [
                        "gs_redis_sentinel_2",
                        "redis-sentinel-2"
                    ],
                    "DriverOpts": null,
                    "GwPriority": 0,
                    "NetworkID": "919bd5f232a0b0588e6ca20e3c563d7ca6731d36e1524f9f82fd1a1f698a1813",
                    "EndpointID": "efba6dd2093a1ab3dc0db918cf8cbb7904e5522df2233c820e9e2577c105e0d7",
                    "Gateway": "172.20.0.1",
                    "IPAddress": "172.20.0.8",
                    "MacAddress": "26:46:85:53:70:c6",
                    "IPPrefixLen": 16,
                    "IPv6Gateway": "",
                    "GlobalIPv6Address": "",
                    "GlobalIPv6PrefixLen": 0,
                    "DNSNames": [
                        "gs_redis_sentinel_2",
                        "redis-sentinel-2",
                        "9c4d8a95d77f"
                    ]
                }
            }
        }
    },
    {
        "Id": "37f960d5853ee3e5e1ebef8309b5f29a4ea0e0f2b86421cba1794a710a2620e4",
        "Created": "2026-05-16T19:30:17.322284984Z",
        "Path": "docker-entrypoint.sh",
        "Args": [
            "sh",
            "-c",
            "cp /usr/local/etc/redis/sentinel.conf /tmp/sentinel.conf \u0026\u0026 printf '\nsentinel auth-pass mymaster %s\n' \"$REDIS_PASSWORD\" \u003e\u003e /tmp/sentinel.conf \u0026\u0026 redis-server /tmp/sentinel.conf --sentinel"
        ],
        "State": {
            "Status": "running",
            "Running": true,
            "Paused": false,
            "Restarting": false,
            "OOMKilled": false,
            "Dead": false,
            "Pid": 1087,
            "ExitCode": 0,
            "Error": "",
            "StartedAt": "2026-05-18T21:45:19.988905773Z",
            "FinishedAt": "2026-05-18T21:45:16.194961346Z",
            "Health": {
                "Status": "healthy",
                "FailingStreak": 0,
                "Log": [
                    {
                        "Start": "2026-05-19T03:10:39.254837206Z",
                        "End": "2026-05-19T03:10:39.321917652Z",
                        "ExitCode": 0,
                        "Output": "Warning: Using a password with '-a' or '-u' option on the command line interface may not be safe.\nAUTH failed: ERR AUTH \u003cpassword\u003e called without any password configured for the default user. Are you sure your configuration is correct?\nPONG\n"
                    },
                    {
                        "Start": "2026-05-19T03:10:49.323005977Z",
                        "End": "2026-05-19T03:10:49.434377702Z",
                        "ExitCode": 0,
                        "Output": "Warning: Using a password with '-a' or '-u' option on the command line interface may not be safe.\nAUTH failed: ERR AUTH \u003cpassword\u003e called without any password configured for the default user. Are you sure your configuration is correct?\nPONG\n"
                    },
                    {
                        "Start": "2026-05-19T03:10:59.351452633Z",
                        "End": "2026-05-19T03:10:59.420359167Z",
                        "ExitCode": 0,
                        "Output": "Warning: Using a password with '-a' or '-u' option on the command line interface may not be safe.\nAUTH failed: ERR AUTH \u003cpassword\u003e called without any password configured for the default user. Are you sure your configuration is correct?\nPONG\n"
                    },
                    {
                        "Start": "2026-05-19T03:11:09.420871495Z",
                        "End": "2026-05-19T03:11:09.461487752Z",
                        "ExitCode": 0,
                        "Output": "Warning: Using a password with '-a' or '-u' option on the command line interface may not be safe.\nAUTH failed: ERR AUTH \u003cpassword\u003e called without any password configured for the default user. Are you sure your configuration is correct?\nPONG\n"
                    },
                    {
                        "Start": "2026-05-19T03:11:19.462642732Z",
                        "End": "2026-05-19T03:11:19.524362943Z",
                        "ExitCode": 0,
                        "Output": "Warning: Using a password with '-a' or '-u' option on the command line interface may not be safe.\nAUTH failed: ERR AUTH \u003cpassword\u003e called without any password configured for the default user. Are you sure your configuration is correct?\nPONG\n"
                    }
                ]
            }
        },
        "Image": "sha256:e74faa347ab0b6a3c1b040834a35ea5f20e3aa02460db4bb9d5b4685f3dd3baf",
        "ResolvConfPath": "/var/lib/docker/containers/37f960d5853ee3e5e1ebef8309b5f29a4ea0e0f2b86421cba1794a710a2620e4/resolv.conf",
        "HostnamePath": "/var/lib/docker/containers/37f960d5853ee3e5e1ebef8309b5f29a4ea0e0f2b86421cba1794a710a2620e4/hostname",
        "HostsPath": "/var/lib/docker/containers/37f960d5853ee3e5e1ebef8309b5f29a4ea0e0f2b86421cba1794a710a2620e4/hosts",
        "LogPath": "/var/lib/docker/containers/37f960d5853ee3e5e1ebef8309b5f29a4ea0e0f2b86421cba1794a710a2620e4/37f960d5853ee3e5e1ebef8309b5f29a4ea0e0f2b86421cba1794a710a2620e4-json.log",
        "Name": "/gs_redis_sentinel_3",
        "RestartCount": 0,
        "Driver": "overlay2",
        "Platform": "linux",
        "MountLabel": "",
        "ProcessLabel": "",
        "AppArmorProfile": "",
        "ExecIDs": null,
        "HostConfig": {
            "Binds": [
                "E:\\GSentinelHealthOS\\broker\\sentinel.conf:/usr/local/etc/redis/sentinel.conf:ro"
            ],
            "ContainerIDFile": "",
            "LogConfig": {
                "Type": "json-file",
                "Config": {
                    "max-file": "2",
                    "max-size": "5m"
                }
            },
            "NetworkMode": "gsentinelhealthos_gs_prod",
            "PortBindings": {},
            "RestartPolicy": {
                "Name": "unless-stopped",
                "MaximumRetryCount": 0
            },
            "AutoRemove": false,
            "VolumeDriver": "",
            "VolumesFrom": null,
            "ConsoleSize": [
                0,
                0
            ],
            "CapAdd": null,
            "CapDrop": null,
            "CgroupnsMode": "private",
            "Dns": [],
            "DnsOptions": [],
            "DnsSearch": [],
            "ExtraHosts": [],
            "GroupAdd": null,
            "IpcMode": "private",
            "Cgroup": "",
            "Links": null,
            "OomScoreAdj": 0,
            "PidMode": "",
            "Privileged": false,
            "PublishAllPorts": false,
            "ReadonlyRootfs": false,
            "SecurityOpt": [
                "no-new-privileges:true"
            ],
            "UTSMode": "",
            "UsernsMode": "",
            "ShmSize": 67108864,
            "Runtime": "runc",
            "Isolation": "",
            "CpuShares": 0,
            "Memory": 134217728,
            "NanoCpus": 250000000,
            "CgroupParent": "",
            "BlkioWeight": 0,
            "BlkioWeightDevice": null,
            "BlkioDeviceReadBps": null,
            "BlkioDeviceWriteBps": null,
            "BlkioDeviceReadIOps": null,
            "BlkioDeviceWriteIOps": null,
            "CpuPeriod": 0,
            "CpuQuota": 0,
            "CpuRealtimePeriod": 0,
            "CpuRealtimeRuntime": 0,
            "CpusetCpus": "",
            "CpusetMems": "",
            "Devices": null,
            "DeviceCgroupRules": null,
            "DeviceRequests": null,
            "MemoryReservation": 0,
            "MemorySwap": 268435456,
            "MemorySwappiness": null,
            "OomKillDisable": null,
            "PidsLimit": null,
            "Ulimits": null,
            "CpuCount": 0,
            "CpuPercent": 0,
            "IOMaximumIOps": 0,
            "IOMaximumBandwidth": 0,
            "Mounts": [
                {
                    "Type": "volume",
                    "Source": "703c697e74cc60a206942050f3e49502f6aa67f93cf94f4c77cc7b8da1196aa9",
                    "Target": "/data"
                }
            ],
            "MaskedPaths": [
                "/proc/acpi",
                "/proc/asound",
                "/proc/interrupts",
                "/proc/kcore",
                "/proc/keys",
                "/proc/latency_stats",
                "/proc/sched_debug",
                "/proc/scsi",
                "/proc/timer_list",
                "/proc/timer_stats",
                "/sys/devices/virtual/powercap",
                "/sys/firmware"
            ],
            "ReadonlyPaths": [
                "/proc/bus",
                "/proc/fs",
                "/proc/irq",
                "/proc/sys",
                "/proc/sysrq-trigger"
            ]
        },
        "GraphDriver": {
            "Data": {
                "ID": "37f960d5853ee3e5e1ebef8309b5f29a4ea0e0f2b86421cba1794a710a2620e4",
                "LowerDir": "/var/lib/docker/overlay2/0cddc83c324ec6fa97a4b14361baf37a3dd2f320b83b700fff3e346c88955c6d-init/diff:/var/lib/docker/overlay2/8c9090380150b4636f6319b5c2b8adc07efaca5df68e948e6418fd36c142f49d/diff:/var/lib/docker/overlay2/e85f396d82ffc5d990826d062fe059185779692ff70111fe596efb62c2876923/diff:/var/lib/docker/overlay2/8cca02262c9f2436236c122d7e63eba78ab4be5b77971c372934efcb7bf5bdf1/diff:/var/lib/docker/overlay2/7267c3d380a80502ea27c1cf22254c597730fa6f0bf94e8b9fcb6dd189c771a1/diff:/var/lib/docker/overlay2/6de7058bf8829c0201fb6b07e6f1b2b08c8be1068e686abc36ee6a8175fd320f/diff:/var/lib/docker/overlay2/4f0da3802045cf986cc9b74d1eeb229e70ab60670cef9f9fbd9b6a77ae4c0ea2/diff:/var/lib/docker/overlay2/fccffb1cd9ddd708bbb163c23a68583fc17fda15258ccaf798f28f97bbe2319d/diff",
                "MergedDir": "/var/lib/docker/overlay2/0cddc83c324ec6fa97a4b14361baf37a3dd2f320b83b700fff3e346c88955c6d/merged",
                "UpperDir": "/var/lib/docker/overlay2/0cddc83c324ec6fa97a4b14361baf37a3dd2f320b83b700fff3e346c88955c6d/diff",
                "WorkDir": "/var/lib/docker/overlay2/0cddc83c324ec6fa97a4b14361baf37a3dd2f320b83b700fff3e346c88955c6d/work"
            },
            "Name": "overlay2"
        },
        "Mounts": [
            {
                "Type": "bind",
                "Source": "E:\\GSentinelHealthOS\\broker\\sentinel.conf",
                "Destination": "/usr/local/etc/redis/sentinel.conf",
                "Mode": "ro",
                "RW": false,
                "Propagation": "rprivate"
            },
            {
                "Type": "volume",
                "Name": "703c697e74cc60a206942050f3e49502f6aa67f93cf94f4c77cc7b8da1196aa9",
                "Source": "/var/lib/docker/volumes/703c697e74cc60a206942050f3e49502f6aa67f93cf94f4c77cc7b8da1196aa9/_data",
                "Destination": "/data",
                "Driver": "local",
                "Mode": "z",
                "RW": true,
                "Propagation": ""
            }
        ],
        "Config": {
            "Hostname": "37f960d5853e",
            "Domainname": "",
            "User": "",
            "AttachStdin": false,
            "AttachStdout": true,
            "AttachStderr": true,
            "ExposedPorts": {
                "6379/tcp": {}
            },
            "Tty": false,
            "OpenStdin": false,
            "StdinOnce": false,
            "Env": [
                "REDIS_PASSWORD=bDAhxY9Af2LcR86iXN7U9gBIDpGeVuaiiKPLBTvEqLP2vbvy",
                "PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
                "REDIS_DOWNLOAD_URL=https://github.com/redis/redis/archive/refs/tags/8.0.2.tar.gz",
                "REDIS_DOWNLOAD_SHA=caf3c0069f06fc84c5153bd2a348b204c578de80490c73857bee01d9b5d7401f"
            ],
            "Cmd": [
                "sh",
                "-c",
                "cp /usr/local/etc/redis/sentinel.conf /tmp/sentinel.conf \u0026\u0026 printf '\nsentinel auth-pass mymaster %s\n' \"$REDIS_PASSWORD\" \u003e\u003e /tmp/sentinel.conf \u0026\u0026 redis-server /tmp/sentinel.conf --sentinel"
            ],
            "Healthcheck": {
                "Test": [
                    "CMD",
                    "sh",
                    "-c",
                    "redis-cli -h localhost -p 26379 -a \"$REDIS_PASSWORD\" ping"
                ],
                "Interval": 10000000000,
                "Timeout": 3000000000,
                "Retries": 5
            },
            "Image": "redis:8.0.2-alpine",
            "Volumes": {
                "/data": {}
            },
            "WorkingDir": "/data",
            "Entrypoint": [
                "docker-entrypoint.sh"
            ],
            "Labels": {
                "com.docker.compose.config-hash": "a421919e56cfada41ca50aae3f126e9d4c96195290b21aeac65f1b22ce794af9",
                "com.docker.compose.container-number": "1",
                "com.docker.compose.depends_on": "redis-replica:service_healthy:false,redis-master:service_healthy:false",
                "com.docker.compose.image": "sha256:e74faa347ab0b6a3c1b040834a35ea5f20e3aa02460db4bb9d5b4685f3dd3baf",
                "com.docker.compose.oneoff": "False",
                "com.docker.compose.project": "gsentinelhealthos",
                "com.docker.compose.project.config_files": "E:\\GSentinelHealthOS\\docker-compose.yml",
                "com.docker.compose.project.working_dir": "E:\\GSentinelHealthOS",
                "com.docker.compose.replace": "gs_redis_sentinel_3",
                "com.docker.compose.service": "redis-sentinel-3",
                "com.docker.compose.version": "5.1.0"
            },
            "StopTimeout": 1
        },
        "NetworkSettings": {
            "SandboxID": "4418939d8699a7e734fd131f4e1effef7b7ec8ec0d81e33f7b99dad5884680ac",
            "SandboxKey": "/var/run/docker/netns/4418939d8699",
            "Ports": {
                "6379/tcp": null
            },
            "Networks": {
                "gsentinelhealthos_gs_prod": {
                    "IPAMConfig": null,
                    "Links": null,
                    "Aliases": [
                        "gs_redis_sentinel_3",
                        "redis-sentinel-3"
                    ],
                    "DriverOpts": null,
                    "GwPriority": 0,
                    "NetworkID": "919bd5f232a0b0588e6ca20e3c563d7ca6731d36e1524f9f82fd1a1f698a1813",
                    "EndpointID": "cd0323a191043df4eb7d6140a13ab1b21b2ce666ac9220b344c4a213367e65ae",
                    "Gateway": "172.20.0.1",
                    "IPAddress": "172.20.0.9",
                    "MacAddress": "7a:35:53:c4:db:6f",
                    "IPPrefixLen": 16,
                    "IPv6Gateway": "",
                    "GlobalIPv6Address": "",
                    "GlobalIPv6PrefixLen": 0,
                    "DNSNames": [
                        "gs_redis_sentinel_3",
                        "redis-sentinel-3",
                        "37f960d5853e"
                    ]
                }
            }
        }
    }
]

```
## Mount classification table
```

container                     type   source
---------                     ----   ------                                                                             
gs_api                        volume /var/lib/docker/volumes/gsentinelhealthos_uploads_data/_data                       
gs_brain                      bind   /run/desktop/mnt/host/e/GSentinelHealthOS/MB-Chat/data                             
gs_brain                      volume /var/lib/docker/volumes/gsentinelhealthos_uploads_data/_data                       
gs_db                         volume /var/lib/docker/volumes/gsentinelhealthos_postgres_data/_data                      
gs_db                         bind   E:\GSentinelHealthOS\database\init-multiple-dbs.sql                                
gs_frontend                   bind   E:\GSentinelHealthOS\MB-Chat\data                                                  
gs_gateway                    volume /var/lib/docker/volumes/gsentinelhealthos_uploads_data/_data                       
gs_grafana                    bind   /run/desktop/mnt/host/e/GSentinelHealthOS/observability/grafana/provisioning       
gs_grafana                    volume /var/lib/docker/volumes/gsentinelhealthos_grafana_data/_data                       
gs_loki                       volume /var/lib/docker/volumes/gsentinelhealthos_loki_data/_data                          
gs_loki                       bind   E:\GSentinelHealthOS\observability\loki-config.yml                                 
gs_outbox_scheduler           bind   E:\GSentinelHealthOS\scripts                                                       
gs_panel_admin                volume /var/lib/docker/volumes/gsentinelhealthos_panel_admin_runtime/_data                
gs_prometheus                 volume /var/lib/docker/volumes/gsentinelhealthos_prometheus_data/_data                    
gs_prometheus                 bind   E:\GSentinelHealthOS\observability\prometheus.yml                                  
gs_promtail                   bind   /var/lib/docker/containers                                                         
gs_promtail                   bind   /var/run/docker.sock                                                               
gs_promtail                   bind   E:\GSentinelHealthOS\observability\promtail-config.yml                             
gs_redis_master               bind   /run/desktop/mnt/host/e/GSentinelHealthOS/broker/redis.conf                        
gs_redis_master               volume /var/lib/docker/volumes/gsentinelhealthos_redis_master_data/_data                  
gs_redis_replica              bind   /run/desktop/mnt/host/e/GSentinelHealthOS/broker/redis.conf                        
gs_redis_replica              volume /var/lib/docker/volumes/gsentinelhealthos_redis_replica_data/_data                 
gs_redis_sentinel_1           volume /var/lib/docker/volumes/fd71a40b8a3b609282459400207ab018f42a4fb8a7352ec47496b53384…
gs_redis_sentinel_1           bind   E:\GSentinelHealthOS\broker\sentinel.conf                                          
gs_redis_sentinel_2           volume /var/lib/docker/volumes/d6e03b8abee05a2a5f74fe3b6ff21f7886e736c2fbdaddf0220e04c899…
gs_redis_sentinel_2           bind   E:\GSentinelHealthOS\broker\sentinel.conf                                          
gs_redis_sentinel_3           volume /var/lib/docker/volumes/703c697e74cc60a206942050f3e49502f6aa67f93cf94f4c77cc7b8da1…
gs_redis_sentinel_3           bind   E:\GSentinelHealthOS\broker\sentinel.conf                                          
gsentinel_redis_precanary_lab volume /var/lib/docker/volumes/cf209b9004adcb0b0d94cf6432af022b3953c52f5d0d1ed6d4186b9df8…


```
## Dangerous RW mounts (code/config risk)
```

container   source                                                 destination                       rw reason
---------   ------                                                 -----------                       -- ------
gs_frontend E:\GSentinelHealthOS\MB-Chat\data                      /app/artifacts/mb-chat-learning True RW mount on cod…
gs_brain    /run/desktop/mnt/host/e/GSentinelHealthOS/MB-Chat/data /app/artifacts/mb-chat-learning True RW mount on cod…


```
## Containers running as root/default-root-likely
```

container                     user                  image                  cmd
---------                     ----                  -----                  ---
gsentinel_redis_precanary_lab (default/root-likely) redis:8.0.2-alpine     redis-server --save  --appendonly no
gs_redis_sentinel_1           (default/root-likely) redis:8.0.2-alpine     sh -c cp /usr/local/etc/redis/sentinel.conf …
gs_redis_replica              (default/root-likely) redis:8.0.2-alpine     sh -c redis-server /usr/local/etc/redis/redi…
gs_db                         (default/root-likely) postgres:16-alpine     postgres -c max_connections=50 -c shared_buf…
gs_redis_master               (default/root-likely) redis:8.0.2-alpine     sh -c redis-server /usr/local/etc/redis/redi…
gs_promtail                   (default/root-likely) grafana/promtail:2.9.8 -config.file=/etc/promtail/promtail-config.y…
gs_redis_sentinel_2           (default/root-likely) redis:8.0.2-alpine     sh -c cp /usr/local/etc/redis/sentinel.conf …
gs_redis_sentinel_3           (default/root-likely) redis:8.0.2-alpine     sh -c cp /usr/local/etc/redis/sentinel.conf …


```
## Processes with potential write capability (command pattern)
```

container            user    command
---------            ----    -------
gs_frontend          nextjs  docker-entrypoint.sh node server.js
gs_brain             appuser python brain/main.py
gs_api               appuser uvicorn api.app.main:app --host 0.0.0.0 --port 8000
gs_panel_admin       nextjs  docker-entrypoint.sh node server.js
gs_outbox_scheduler  appuser python scripts/run_outbox_scheduler.py
gs_gateway           appuser uvicorn whatsapp_gateway.app.main:app --host 0.0.0.0 --port 8002
gs_nlg_service       appuser uvicorn services.nlg_service.main:app --host 0.0.0.0 --port 8013 --workers 1
gs_dialogue_engine   appuser uvicorn services.dialogue_engine.main:app --host 0.0.0.0 --port 8010 --workers 1
gs_booking_worker_1  appuser python -m api.app.booking_queue_worker_main
gs_inference_service appuser uvicorn services.inference_service.main:app --host 0.0.0.0 --port 8011 --workers 1
gs_decision_service  appuser uvicorn services.decision_service.main:app --host 0.0.0.0 --port 8012 --workers 1
gs_booking_worker_0  appuser python -m api.app.booking_queue_worker_main


```
## Runtime paths mixed with Git repo (RW mounts whose source under repo root)
```

container   type source                            destination                       rw class
---------   ---- ------                            -----------                       -- -----
gs_frontend bind E:\GSentinelHealthOS\MB-Chat\data /app/artifacts/mb-chat-learning True code/config-risk


```
