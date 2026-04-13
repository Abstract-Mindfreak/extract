request url: https://www.producer.ai/__api/clips/auth-user?limit=20&offset=0&filter=generations&include_disliked=false

fetch("https://www.producer.ai/__api/clips/auth-user?limit=20&offset=0&filter=generations&include_disliked=false", {
  "headers": {
    "accept": "*/*",
    "accept-language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7,es;q=0.6",
    "authorization": "Bearer eyJhbGciOiJIUzI1NiIsImtpZCI6IllvMDR4Zm5kZWNDcktOd2ciLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL2VkbmpjY3FjbWJ4ZWF4YmlkaW5yLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiJlMTcxOWFiYy1kNDlhLTQwOTUtODYzZi0wYWU2MzdmNjViZjQiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzc2MTA4NTYxLCJpYXQiOjE3NzYxMDQ5NjEsImVtYWlsIjoibXVuZ29yb2RuYW5ldmVAZ21haWwuY29tIiwicGhvbmUiOiIiLCJhcHBfbWV0YWRhdGEiOnsicHJvdmlkZXIiOiJnb29nbGUiLCJwcm92aWRlcnMiOlsiZ29vZ2xlIl19LCJ1c2VyX21ldGFkYXRhIjp7ImF2YXRhcl91cmwiOiJodHRwczovL2xoMy5nb29nbGV1c2VyY29udGVudC5jb20vYS9BQ2c4b2NMM0RXaHNfMVhXcEtZdUFSbzZBYW8yWkFwODJWSVd0Y2dUM2RFZUNoZmNfd24tbWRNPXM5Ni1jIiwiZW1haWwiOiJtdW5nb3JvZG5hbmV2ZUBnbWFpbC5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwiZnVsbF9uYW1lIjoiQWJzdHJhY3QgTWluZGZyZWFrIiwiaXNzIjoiaHR0cHM6Ly9hY2NvdW50cy5nb29nbGUuY29tIiwibmFtZSI6IkFic3RyYWN0IE1pbmRmcmVhayIsInBob25lX3ZlcmlmaWVkIjpmYWxzZSwicGljdHVyZSI6Imh0dHBzOi8vbGgzLmdvb2dsZXVzZXJjb250ZW50LmNvbS9hL0FDZzhvY0wzRFdoc18xWFdwS1l1QVJvNkFhbzJaQXA4MlZJV3RjZ1QzZEVlQ2hmY193bi1tZE09czk2LWMiLCJwcm92aWRlcl9pZCI6IjExMDIzNzk1OTcxNjQ3MDEwODUwOCIsInN1YiI6IjExMDIzNzk1OTcxNjQ3MDEwODUwOCJ9LCJyb2xlIjoiYXV0aGVudGljYXRlZCIsImFhbCI6ImFhbDEiLCJhbXIiOlt7Im1ldGhvZCI6Im9hdXRoIiwidGltZXN0YW1wIjoxNzc2MDEyMzk5fV0sInNlc3Npb25faWQiOiJiOTM2OGJjNC01YWRkLTQxZjktYjQ5Ny1iMjU4YWQzMDFkMGQiLCJpc19hbm9ueW1vdXMiOmZhbHNlfQ.YUuhSbs6tYbmJH_Kbs1wGYTECBQaylGvsF0o0zzAjKo",
    "cache-control": "no-cache",
    "content-type": "application/json",
    "pragma": "no-cache",
    "priority": "u=1, i",
    "sec-ch-ua": "\"Chromium\";v=\"146\", \"Not-A.Brand\";v=\"24\", \"Google Chrome\";v=\"146\"",
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": "\"Windows\"",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
    "traceparent": "00-ad5b4140ffa33ca21e16b8f1a258779c-64149878535c57e5-00"
  },
  "referrer": "https://www.producer.ai/library/my-songs",
  "body": null,
  "method": "GET",
  "mode": "cors",
  "credentials": "include"
});

Вот его preview 
[
    {
        "id": "1cd31c8e-5ac5-469e-89b2-3603703396bd",
        "author_id": "e1719abc-d49a-4095-863f-0ae637f65bf4",
        "op_id": "eb0c1391-c7b3-5b04-9616-7d2498d610b5",
        "op_type": "audio__create_song",
        "duration": {
            "status": "completed",
            "value": "152.8"
        },
        "lyrics": {
            "status": "completed",
            "value": {
                "id": "55161754-f78d-5b7f-9fa2-6a3cc8d6ba93",
                "text": "[Instrumental]"
            }
        },
        "lyrics_timing": {
            "status": "not_requested"
        },
        "user_edited_lyrics_id": null,
        "title": "Honky_Symphony_Impro_Sync Beta",
        "privacy": "unlisted",
        "allow_public_use": true,
        "image_id": "eb0c1391-c7b3-5b04-9616-7d2498d610b5",
        "video_id": null,
        "created_at": "2026-04-13T15:58:11.120062Z",
        "deleted_at": null,
        "operation": {
            "op_type": "audio__create_song",
            "conversation_id": "dab6e92c-8207-4311-ba21-fead6f558b2c",
            "sound_prompt": "Φ_TOTAL_LATERAL_DIVERGENCE: MetaSelector(EVOLVE(Symphonic_Honky_Tonk, 3)). Live orchestral swing architecture, algorithmic counterpoint, saloon-style piano shards, gravitational symphonic quantization. No trap grid, no 808s. Biomechanical acoustic jazz fusion. 240 bpm",
            "title": "Honky_Symphony_Impro_Sync Beta",
            "seed": null,
            "lyrics_id": ""
        },
        "is_favorite": false,
        "preference_state": null,
        "favorite_count": 0,
        "play_count": 3,
        "audio_url": "https://storage.googleapis.com/producer-app-public/clips/1cd31c8e-5ac5-469e-89b2-3603703396bd.m4a",
        "wav_url": "https://storage.googleapis.com/producer-app-public/clips/1cd31c8e-5ac5-469e-89b2-3603703396bd.wav",
        "image_url": "https://storage.googleapis.com/producer-app-public/assets/eb0c1391-c7b3-5b04-9616-7d2498d610b5.jpg",
        "video_url": null
    },
    {
        "id": "4b996a84-c925-427b-ae27-2c622df42ac7",
        "author_id": "e1719abc-d49a-4095-863f-0ae637f65bf4",
        "op_id": "738ea7b4-1253-5fd7-bc5c-a066ea714301",
        "op_type": "audio__create_song",
        "duration": {
            "status": "completed",
            "value": "154.05866666666665"
        },
        "lyrics": {
            "status": "completed",
            "value": {
                "id": "55161754-f78d-5b7f-9fa2-6a3cc8d6ba93",
                "text": "[Instrumental]"
            }
        },
        "lyrics_timing": {
            "status": "not_requested"
        },
        "user_edited_lyrics_id": null,
        "title": "Honky_Symphony_Impro_Sync Alpha",
        "privacy": "unlisted",
        "allow_public_use": true,
        "image_id": "738ea7b4-1253-5fd7-bc5c-a066ea714301",
        "video_id": null,
        "created_at": "2026-04-13T15:58:09.522690Z",
        "deleted_at": null,
        "operation": {
            "op_type": "audio__create_song",
            "conversation_id": "dab6e92c-8207-4311-ba21-fead6f558b2c",
            "sound_prompt": "Φ_TOTAL_LATERAL_DIVERGENCE: Honky-tonk Swing Symphony Orchestra improvisation. HF(x) = x ⊗ self(x). Detuned saloon piano, frantic symphonic brass, recursive swing rhythms. Prime number signatures (7/8, 11/8), non-linear orchestral textures, chaotic improvised solo sections. Absolute erasure of trap tropes. V: 0.999, S: 0.001, D_f: 88.5. 240 bpm",
            "title": "Honky_Symphony_Impro_Sync Alpha",
            "seed": null,
            "lyrics_id": ""
        },
        "is_favorite": true,
        "preference_state": "liked",
        "favorite_count": 1,
        "play_count": 2,
        "audio_url": "https://storage.googleapis.com/producer-app-public/clips/4b996a84-c925-427b-ae27-2c622df42ac7.m4a",
        "wav_url": "https://storage.googleapis.com/producer-app-public/clips/4b996a84-c925-427b-ae27-2c622df42ac7.wav",
        "image_url": "https://storage.googleapis.com/producer-app-public/assets/738ea7b4-1253-5fd7-bc5c-a066ea714301.jpg",
        "video_url": null
    },
    {
        "id": "dcd53ec4-2010-422e-b53a-ce52bfce4611",
        "author_id": "e1719abc-d49a-4095-863f-0ae637f65bf4",
        "op_id": "63a25b56-6da9-501f-8a42-34ccdaf8f628",
        "op_type": "audio__create_song",
        "duration": {
            "status": "completed",
            "value": "148.672"
        },
        "lyrics": {
            "status": "completed",
            "value": {
                "id": "55161754-f78d-5b7f-9fa2-6a3cc8d6ba93",
                "text": "[Instrumental]"
            }
        },
        "lyrics_timing": {
            "status": "not_requested"
        },
        "user_edited_lyrics_id": null,
        "title": "Bebop_Sonata_Impro_Sync Alpha",
        "privacy": "unlisted",
        "allow_public_use": true,
        "image_id": "63a25b56-6da9-501f-8a42-34ccdaf8f628",
        "video_id": null,
        "created_at": "2026-04-13T15:37:55.873750Z",
        "deleted_at": null,
        "operation": {
            "op_type": "audio__create_song",
            "conversation_id": "dab6e92c-8207-4311-ba21-fead6f558b2c",
            "sound_prompt": "Φ_TOTAL_LATERAL_DIVERGENCE: Math Algorithmic Bebop Sonata. HF(x) = x ⊗ self(x). Recursive sonata-form structure, frantic bebop improvisations, live acoustic harmony twist. Prime number signatures (17/8, 19/8), non-linear piano polyphony, dissonant chromatic shifts. No grid, no trap tropes. V: 0.999, S: 0.001, D_f: 99.5. 300 bpm",
            "title": "Bebop_Sonata_Impro_Sync Alpha",
            "seed": null,
            "lyrics_id": ""
        },
        "is_favorite": false,
        "preference_state": null,
        "favorite_count": 0,
        "play_count": 1,
        "audio_url": "https://storage.googleapis.com/producer-app-public/clips/dcd53ec4-2010-422e-b53a-ce52bfce4611.m4a",
        "wav_url": "https://storage.googleapis.com/producer-app-public/clips/dcd53ec4-2010-422e-b53a-ce52bfce4611.wav",
        "image_url": "https://storage.googleapis.com/producer-app-public/assets/63a25b56-6da9-501f-8a42-34ccdaf8f628.jpg",
        "video_url": null
    },
    {
        "id": "ae4357e8-2b69-4f70-9a06-8f1a6189459e",
        "author_id": "e1719abc-d49a-4095-863f-0ae637f65bf4",
        "op_id": "1e55db4a-66ac-578e-a0e7-4b90505dd1fb",
        "op_type": "audio__create_song",
        "duration": {
            "status": "completed",
            "value": "174.31466666666665"
        },
        "lyrics": {
            "status": "completed",
            "value": {
                "id": "55161754-f78d-5b7f-9fa2-6a3cc8d6ba93",
                "text": "[Instrumental]"
            }
        },
        "lyrics_timing": {
            "status": "not_requested"
        },
        "user_edited_lyrics_id": null,
        "title": "Bebop_Sonata_Impro_Sync Beta",
        "privacy": "unlisted",
        "allow_public_use": true,
        "image_id": "1e55db4a-66ac-578e-a0e7-4b90505dd1fb",
        "video_id": null,
        "created_at": "2026-04-13T15:37:51.340476Z",
        "deleted_at": null,
        "operation": {
            "op_type": "audio__create_song",
            "conversation_id": "dab6e92c-8207-4311-ba21-fead6f558b2c",
            "sound_prompt": "Φ_TOTAL_LATERAL_DIVERGENCE: MetaSelector(EVOLVE(Bebop_Sonata_Twist, 3)). Live acoustic harmony architecture, algorithmic counterpoint, chaotic sonata development, gravitational bebop quantization. Absolute erasure of trap grids. Biomechanical acoustic chamber jazz. 300 bpm",
            "title": "Bebop_Sonata_Impro_Sync Beta",
            "seed": null,
            "lyrics_id": ""
        },
        "is_favorite": true,
        "preference_state": "liked",
        "favorite_count": 1,
        "play_count": 2,
        "audio_url": "https://storage.googleapis.com/producer-app-public/clips/ae4357e8-2b69-4f70-9a06-8f1a6189459e.m4a",
        "wav_url": "https://storage.googleapis.com/producer-app-public/clips/ae4357e8-2b69-4f70-9a06-8f1a6189459e.wav",
        "image_url": "https://storage.googleapis.com/producer-app-public/assets/1e55db4a-66ac-578e-a0e7-4b90505dd1fb.jpg",
        "video_url": null
    },
    {
        "id": "697bf6bc-a07e-487f-8283-1115efd20115",
        "author_id": "e1719abc-d49a-4095-863f-0ae637f65bf4",
        "op_id": "08ff7ca0-fb26-52b5-b16a-8def251f3884",
        "op_type": "audio__create_song",
        "duration": {
            "status": "completed",
            "value": "172.768"
        },
        "lyrics": {
            "status": "completed",
            "value": {
                "id": "55161754-f78d-5b7f-9fa2-6a3cc8d6ba93",
                "text": "[Instrumental]"
            }
        },
        "lyrics_timing": {
            "status": "not_requested"
        },
        "user_edited_lyrics_id": null,
        "title": "Φ_total: Electrofunk Grammatic [Alpha]",
        "privacy": "unlisted",
        "allow_public_use": true,
        "image_id": "08ff7ca0-fb26-52b5-b16a-8def251f3884",
        "video_id": null,
        "created_at": "2026-04-12T23:06:09.799347Z",
        "deleted_at": null,
        "operation": {
            "op_type": "audio__create_song",
            "conversation_id": "f423db3c-287a-4a3e-be12-8716431710e0",
            "sound_prompt": "HF(x) = x ⊗ self(x) // electrofunk divergence, robotic synth syncopation, aperiodic organic groove, non-linear harmonic grammar, fractal funk layering, metallic transients, tectonic sub-weight, 114 bpm",
            "title": "Φ_total: Electrofunk Grammatic [Alpha]",
            "seed": null,
            "lyrics_id": ""
        },
        "is_favorite": false,
        "preference_state": null,
        "favorite_count": 0,
        "play_count": 3,
        "audio_url": "https://storage.googleapis.com/producer-app-public/clips/697bf6bc-a07e-487f-8283-1115efd20115.m4a",
        "wav_url": "https://storage.googleapis.com/producer-app-public/clips/697bf6bc-a07e-487f-8283-1115efd20115.wav",
        "image_url": "https://storage.googleapis.com/producer-app-public/assets/08ff7ca0-fb26-52b5-b16a-8def251f3884.jpg",
        "video_url": null
    },
    {
        "id": "6fda09db-d46d-45e6-9bd8-1299659ff8f7",
        "author_id": "e1719abc-d49a-4095-863f-0ae637f65bf4",
        "op_id": "b8f359ba-0e81-5241-871f-9cd48f9542df",
        "op_type": "audio__create_song",
        "duration": {
            "status": "completed",
            "value": "145.888"
        },
        "lyrics": {
            "status": "completed",
            "value": {
                "id": "55161754-f78d-5b7f-9fa2-6a3cc8d6ba93",
                "text": "[Instrumental]"
            }
        },
        "lyrics_timing": {
            "status": "not_requested"
        },
        "user_edited_lyrics_id": null,
        "title": "Φ_total: Electrofunk Grammatic [Beta]",
        "privacy": "unlisted",
        "allow_public_use": true,
        "image_id": "b8f359ba-0e81-5241-871f-9cd48f9542df",
        "video_id": null,
        "created_at": "2026-04-12T23:06:05.371896Z",
        "deleted_at": null,
        "operation": {
            "op_type": "audio__create_song",
            "conversation_id": "f423db3c-287a-4a3e-be12-8716431710e0",
            "sound_prompt": "HF(x) = x ⊗ self(x) // divergent electrofunk, grammatical sound architecture, stochastic rhythm grid inversion, frequency hopping synth leads, deep biomechanical funk, recursive pattern evolution, 108 bpm",
            "title": "Φ_total: Electrofunk Grammatic [Beta]",
            "seed": null,
            "lyrics_id": ""
        },
        "is_favorite": false,
        "preference_state": null,
        "favorite_count": 0,
        "play_count": 4,
        "audio_url": "https://storage.googleapis.com/producer-app-public/clips/6fda09db-d46d-45e6-9bd8-1299659ff8f7.m4a",
        "wav_url": "https://storage.googleapis.com/producer-app-public/clips/6fda09db-d46d-45e6-9bd8-1299659ff8f7.wav",
        "image_url": "https://storage.googleapis.com/producer-app-public/assets/b8f359ba-0e81-5241-871f-9cd48f9542df.jpg",
        "video_url": null
    },
    {
        "id": "4adcc6ee-e5b3-48e9-b182-6ad2984b0fd0",
        "author_id": "e1719abc-d49a-4095-863f-0ae637f65bf4",
        "op_id": "c90eee5f-38ff-528f-8629-64f6ef234d18",
        "op_type": "audio__create_song",
        "duration": {
            "status": "completed",
            "value": "152.62933333333334"
        },
        "lyrics": {
            "status": "completed",
            "value": {
                "id": "55161754-f78d-5b7f-9fa2-6a3cc8d6ba93",
                "text": "[Instrumental]"
            }
        },
        "lyrics_timing": {
            "status": "not_requested"
        },
        "user_edited_lyrics_id": null,
        "title": "Φ_total: Fractalize [Beta]",
        "privacy": "unlisted",
        "allow_public_use": true,
        "image_id": "c90eee5f-38ff-528f-8629-64f6ef234d18",
        "video_id": null,
        "created_at": "2026-04-12T23:01:14.665512Z",
        "deleted_at": null,
        "operation": {
            "op_type": "audio__create_song",
            "conversation_id": "f423db3c-287a-4a3e-be12-8716431710e0",
            "sound_prompt": "HF(x) = x ⊗ self(x) // stochastic genre hybrid, unexpected spectral shifts, zero-point entropy transients, biomechanical textures, 122 bpm",
            "title": "Φ_total: Fractalize [Beta]",
            "seed": null,
            "lyrics_id": ""
        },
        "is_favorite": false,
        "preference_state": null,
        "favorite_count": 0,
        "play_count": 4,
        "audio_url": "https://storage.googleapis.com/producer-app-public/clips/4adcc6ee-e5b3-48e9-b182-6ad2984b0fd0.m4a",
        "wav_url": "https://storage.googleapis.com/producer-app-public/clips/4adcc6ee-e5b3-48e9-b182-6ad2984b0fd0.wav",
        "image_url": "https://storage.googleapis.com/producer-app-public/assets/c90eee5f-38ff-528f-8629-64f6ef234d18.jpg",
        "video_url": null
    },
    {
        "id": "1ee4da73-2935-4469-84f5-918d427b99bb",
        "author_id": "e1719abc-d49a-4095-863f-0ae637f65bf4",
        "op_id": "cf3d6c4f-2595-4812-a571-86995c242485",
        "op_type": "audio__create_song",
        "duration": {
            "status": "completed",
            "value": "159.57333333333332"
        },
        "lyrics": {
            "status": "completed",
            "value": {
                "id": "55161754-f78d-5b7f-9fa2-6a3cc8d6ba93",
                "text": "[Instrumental]"
            }
        },
        "lyrics_timing": {
            "status": "not_requested"
        },
        "user_edited_lyrics_id": null,
        "title": "Φ_total: Fractalize [Alpha]",
        "privacy": "unlisted",
        "allow_public_use": true,
        "image_id": "cf3d6c4f-2595-4812-a571-86995c242485",
        "video_id": null,
        "created_at": "2026-04-12T23:01:12.305297Z",
        "deleted_at": null,
        "operation": {
            "op_type": "audio__create_song",
            "conversation_id": "f423db3c-287a-4a3e-be12-8716431710e0",
            "sound_prompt": "HF(x) = x ⊗ self(x) // recursive fractal layering, non-linear motive evolution, divergent timbres, rhythmic displacement, 95 bpm",
            "title": "Φ_total: Fractalize [Alpha]",
            "seed": null,
            "lyrics_id": ""
        },
        "is_favorite": false,
        "preference_state": null,
        "favorite_count": 0,
        "play_count": 1,
        "audio_url": "https://storage.googleapis.com/producer-app-public/clips/1ee4da73-2935-4469-84f5-918d427b99bb.m4a",
        "wav_url": "https://storage.googleapis.com/producer-app-public/clips/1ee4da73-2935-4469-84f5-918d427b99bb.wav",
        "image_url": "https://storage.googleapis.com/producer-app-public/assets/cf3d6c4f-2595-4812-a571-86995c242485.jpg",
        "video_url": null
    },
    {
        "id": "3d73a405-8354-4621-9131-2ebaa2efa6e0",
        "author_id": "e1719abc-d49a-4095-863f-0ae637f65bf4",
        "op_id": "56b7d65d-fb7f-5dce-8749-90084c417749",
        "op_type": "audio__create_song",
        "duration": {
            "status": "completed",
            "value": "163.59466666666665"
        },
        "lyrics": {
            "status": "completed",
            "value": {
                "id": "55161754-f78d-5b7f-9fa2-6a3cc8d6ba93",
                "text": "[Instrumental]"
            }
        },
        "lyrics_timing": {
            "status": "not_requested"
        },
        "user_edited_lyrics_id": null,
        "title": "Φ_total: Fractalize [Alpha]",
        "privacy": "unlisted",
        "allow_public_use": true,
        "image_id": "56b7d65d-fb7f-5dce-8749-90084c417749",
        "video_id": null,
        "created_at": "2026-04-12T23:01:11.795905Z",
        "deleted_at": null,
        "operation": {
            "op_type": "audio__create_song",
            "conversation_id": "f423db3c-287a-4a3e-be12-8716431710e0",
            "sound_prompt": "HF(x) = x ⊗ self(x) // recursive fractal layering, non-linear motive evolution, divergent timbres, rhythmic displacement, 95 bpm",
            "title": "Φ_total: Fractalize [Alpha]",
            "seed": null,
            "lyrics_id": ""
        },
        "is_favorite": false,
        "preference_state": null,
        "favorite_count": 0,
        "play_count": 0,
        "audio_url": "https://storage.googleapis.com/producer-app-public/clips/3d73a405-8354-4621-9131-2ebaa2efa6e0.m4a",
        "wav_url": "https://storage.googleapis.com/producer-app-public/clips/3d73a405-8354-4621-9131-2ebaa2efa6e0.wav",
        "image_url": "https://storage.googleapis.com/producer-app-public/assets/56b7d65d-fb7f-5dce-8749-90084c417749.jpg",
        "video_url": null
    },
    {
        "id": "55a89fda-bfaa-4c73-937c-74fa51c97314",
        "author_id": "e1719abc-d49a-4095-863f-0ae637f65bf4",
        "op_id": "5f77b3ea-ee68-452d-851b-d51ad0c4004b",
        "op_type": "audio__create_song",
        "duration": {
            "status": "completed",
            "value": "175.43466666666666"
        },
        "lyrics": {
            "status": "completed",
            "value": {
                "id": "55161754-f78d-5b7f-9fa2-6a3cc8d6ba93",
                "text": "[Instrumental]"
            }
        },
        "lyrics_timing": {
            "status": "not_requested"
        },
        "user_edited_lyrics_id": null,
        "title": "Φ_audio(t) [Awakening] Phase Gamma",
        "privacy": "unlisted",
        "allow_public_use": true,
        "image_id": "5f77b3ea-ee68-452d-851b-d51ad0c4004b",
        "video_id": null,
        "created_at": "2026-04-12T22:52:53.784886Z",
        "deleted_at": null,
        "operation": {
            "op_type": "audio__create_song",
            "conversation_id": "f423db3c-287a-4a3e-be12-8716431710e0",
            "sound_prompt": "divergent synthesis, fractal audio structures, rhythmic metallic clicks, deep atmospheric sub-harmonics, evolving non-linear soundscape, organic mechanical textures, 104 bpm",
            "title": "Φ_audio(t) [Awakening] Phase Gamma",
            "seed": null,
            "lyrics_id": ""
        },
        "is_favorite": false,
        "preference_state": null,
        "favorite_count": 0,
        "play_count": 0,
        "audio_url": "https://storage.googleapis.com/producer-app-public/clips/55a89fda-bfaa-4c73-937c-74fa51c97314.m4a",
        "wav_url": "https://storage.googleapis.com/producer-app-public/clips/55a89fda-bfaa-4c73-937c-74fa51c97314.wav",
        "image_url": "https://storage.googleapis.com/producer-app-public/assets/5f77b3ea-ee68-452d-851b-d51ad0c4004b.jpg",
        "video_url": null
    },
    {
        "id": "e09e4ffb-1413-433f-820a-f5fa8ac38549",
        "author_id": "e1719abc-d49a-4095-863f-0ae637f65bf4",
        "op_id": "c4dcacb8-61db-5f93-88fa-a6e86782f20d",
        "op_type": "audio__create_song",
        "duration": {
            "status": "completed",
            "value": "144.07466666666667"
        },
        "lyrics": {
            "status": "completed",
            "value": {
                "id": "55161754-f78d-5b7f-9fa2-6a3cc8d6ba93",
                "text": "[Instrumental]"
            }
        },
        "lyrics_timing": {
            "status": "not_requested"
        },
        "user_edited_lyrics_id": null,
        "title": "Φ_audio(t) [Awakening] Phase Gamma",
        "privacy": "unlisted",
        "allow_public_use": true,
        "image_id": "c4dcacb8-61db-5f93-88fa-a6e86782f20d",
        "video_id": null,
        "created_at": "2026-04-12T22:52:53.293575Z",
        "deleted_at": null,
        "operation": {
            "op_type": "audio__create_song",
            "conversation_id": "f423db3c-287a-4a3e-be12-8716431710e0",
            "sound_prompt": "divergent synthesis, fractal audio structures, rhythmic metallic clicks, deep atmospheric sub-harmonics, evolving non-linear soundscape, organic mechanical textures, 104 bpm",
            "title": "Φ_audio(t) [Awakening] Phase Gamma",
            "seed": null,
            "lyrics_id": ""
        },
        "is_favorite": false,
        "preference_state": null,
        "favorite_count": 0,
        "play_count": 0,
        "audio_url": "https://storage.googleapis.com/producer-app-public/clips/e09e4ffb-1413-433f-820a-f5fa8ac38549.m4a",
        "wav_url": "https://storage.googleapis.com/producer-app-public/clips/e09e4ffb-1413-433f-820a-f5fa8ac38549.wav",
        "image_url": "https://storage.googleapis.com/producer-app-public/assets/c4dcacb8-61db-5f93-88fa-a6e86782f20d.jpg",
        "video_url": null
    },
    {
        "id": "c7fcfd22-e75a-4d51-936d-f39128c0636e",
        "author_id": "e1719abc-d49a-4095-863f-0ae637f65bf4",
        "op_id": "bebcc7ed-8622-5ccb-9349-87b51150b5f3",
        "op_type": "audio__create_song",
        "duration": {
            "status": "completed",
            "value": "146.28266666666667"
        },
        "lyrics": {
            "status": "completed",
            "value": {
                "id": "55161754-f78d-5b7f-9fa2-6a3cc8d6ba93",
                "text": "[Instrumental]"
            }
        },
        "lyrics_timing": {
            "status": "not_requested"
        },
        "user_edited_lyrics_id": null,
        "title": "Φ_audio(t) [Awakening] Phase Alpha",
        "privacy": "unlisted",
        "allow_public_use": true,
        "image_id": "bebcc7ed-8622-5ccb-9349-87b51150b5f3",
        "video_id": null,
        "created_at": "2026-04-12T22:52:18.087233Z",
        "deleted_at": null,
        "operation": {
            "op_type": "audio__create_song",
            "conversation_id": "f423db3c-287a-4a3e-be12-8716431710e0",
            "sound_prompt": "Φ_total divergent synthesis, D_f=9.5, R_T=2.618, lateral divergence audio, zero-point entropy rhythmic snaps, gravitational quantization inversion, non-linear fractal textures, tectonic sub-bass, metallic sand-noise shimmer, 88 bpm",
            "title": "Φ_audio(t) [Awakening] Phase Alpha",
            "seed": null,
            "lyrics_id": ""
        },
        "is_favorite": false,
        "preference_state": null,
        "favorite_count": 0,
        "play_count": 1,
        "audio_url": "https://storage.googleapis.com/producer-app-public/clips/c7fcfd22-e75a-4d51-936d-f39128c0636e.m4a",
        "wav_url": "https://storage.googleapis.com/producer-app-public/clips/c7fcfd22-e75a-4d51-936d-f39128c0636e.wav",
        "image_url": "https://storage.googleapis.com/producer-app-public/assets/bebcc7ed-8622-5ccb-9349-87b51150b5f3.jpg",
        "video_url": null
    },
    {
        "id": "0fb66d2a-24a0-4eae-8571-d92c96d1f63c",
        "author_id": "e1719abc-d49a-4095-863f-0ae637f65bf4",
        "op_id": "4c37da13-83d4-5305-9728-a7cab49f4de5",
        "op_type": "audio__create_song",
        "duration": {
            "status": "completed",
            "value": "144.07466666666667"
        },
        "lyrics": {
            "status": "completed",
            "value": {
                "id": "55161754-f78d-5b7f-9fa2-6a3cc8d6ba93",
                "text": "[Instrumental]"
            }
        },
        "lyrics_timing": {
            "status": "not_requested"
        },
        "user_edited_lyrics_id": null,
        "title": "Φ_Total: Multiverse Synthesis Beta",
        "privacy": "unlisted",
        "allow_public_use": true,
        "image_id": "4c37da13-83d4-5305-9728-a7cab49f4de5",
        "video_id": null,
        "created_at": "2026-04-12T22:36:50.137392Z",
        "deleted_at": null,
        "operation": {
            "op_type": "audio__create_song",
            "conversation_id": "33d4c8d8-c156-4ddc-ba3a-6d11ec03f300",
            "sound_prompt": "experimental ethno-bebop deconstruction, quantum-folk entanglement layers, biological rhythmic DNA, negative-space sonata development, silence-operator gravitational pulses, G-graph topological reconfiguration, ℱₘ-type probabilistic engineering, ancient microtonal strings vs bop brass, ℱ-type algorithmic decay, phase_shift_v3.0, tectonic sub-harmonic Ω-resonance, 300 bpm micro-syncopation, latent_dim=384, D_f=380.0",
            "title": "Φ_Total: Multiverse Synthesis Beta",
            "seed": null,
            "lyrics_id": ""
        },
        "is_favorite": true,
        "preference_state": "liked",
        "favorite_count": 1,
        "play_count": 1,
        "audio_url": "https://storage.googleapis.com/producer-app-public/clips/0fb66d2a-24a0-4eae-8571-d92c96d1f63c.m4a",
        "wav_url": "https://storage.googleapis.com/producer-app-public/clips/0fb66d2a-24a0-4eae-8571-d92c96d1f63c.wav",
        "image_url": "https://storage.googleapis.com/producer-app-public/assets/4c37da13-83d4-5305-9728-a7cab49f4de5.jpg",
        "video_url": null
    },
    {
        "id": "afbc68d0-1f69-4f36-9a2f-fa4002e39774",
        "author_id": "e1719abc-d49a-4095-863f-0ae637f65bf4",
        "op_id": "eb85dfb0-e99c-4e45-ba23-957bfbb8411f",
        "op_type": "audio__create_song",
        "duration": {
            "status": "completed",
            "value": "141.68533333333335"
        },
        "lyrics": {
            "status": "completed",
            "value": {
                "id": "55161754-f78d-5b7f-9fa2-6a3cc8d6ba93",
                "text": "[Instrumental]"
            }
        },
        "lyrics_timing": {
            "status": "not_requested"
        },
        "user_edited_lyrics_id": null,
        "title": "Φ_Total: Multiverse Synthesis Alpha",
        "privacy": "unlisted",
        "allow_public_use": true,
        "image_id": "eb85dfb0-e99c-4e45-ba23-957bfbb8411f",
        "video_id": null,
        "created_at": "2026-04-12T22:36:48.365782Z",
        "deleted_at": null,
        "operation": {
            "op_type": "audio__create_song",
            "conversation_id": "33d4c8d8-c156-4ddc-ba3a-6d11ec03f300",
            "sound_prompt": "hyper-complex synthesis, ancient microtonal throat singing, bebop-fusion syncopation, quantum-entanglement harmonic layers, organic cell-growth DNA-sequencing, sonata form negative-space architecture, gravity-resonance silence-operator, Cosmic Transformer attention_weights, mathematical noise-denoising, ∇Ω future-pull transients, acoustic-biomechanical fragments, V=0.999, D_f=350.0, 144 bpm, holographic void acoustics, zero-point entropy transients, non-linear time-stretching",
            "title": "Φ_Total: Multiverse Synthesis Alpha",
            "seed": null,
            "lyrics_id": ""
        },
        "is_favorite": false,
        "preference_state": null,
        "favorite_count": 0,
        "play_count": 3,
        "audio_url": "https://storage.googleapis.com/producer-app-public/clips/afbc68d0-1f69-4f36-9a2f-fa4002e39774.m4a",
        "wav_url": "https://storage.googleapis.com/producer-app-public/clips/afbc68d0-1f69-4f36-9a2f-fa4002e39774.wav",
        "image_url": "https://storage.googleapis.com/producer-app-public/assets/eb85dfb0-e99c-4e45-ba23-957bfbb8411f.jpg",
        "video_url": null
    },
    {
        "id": "a932fa3f-e9e5-4614-8df4-020920ff18d9",
        "author_id": "e1719abc-d49a-4095-863f-0ae637f65bf4",
        "op_id": "f38efb8c-8ce9-52b2-a84f-58d83777e0d2",
        "op_type": "audio__create_song",
        "duration": {
            "status": "completed",
            "value": "168.36266666666666"
        },
        "lyrics": {
            "status": "completed",
            "value": {
                "id": "55161754-f78d-5b7f-9fa2-6a3cc8d6ba93",
                "text": "[Instrumental]"
            }
        },
        "lyrics_timing": {
            "status": "not_requested"
        },
        "user_edited_lyrics_id": null,
        "title": "Φ_Total: Multiverse Synthesis Alpha",
        "privacy": "unlisted",
        "allow_public_use": true,
        "image_id": "f38efb8c-8ce9-52b2-a84f-58d83777e0d2",
        "video_id": null,
        "created_at": "2026-04-12T22:36:47.864163Z",
        "deleted_at": null,
        "operation": {
            "op_type": "audio__create_song",
            "conversation_id": "33d4c8d8-c156-4ddc-ba3a-6d11ec03f300",
            "sound_prompt": "hyper-complex synthesis, ancient microtonal throat singing, bebop-fusion syncopation, quantum-entanglement harmonic layers, organic cell-growth DNA-sequencing, sonata form negative-space architecture, gravity-resonance silence-operator, Cosmic Transformer attention_weights, mathematical noise-denoising, ∇Ω future-pull transients, acoustic-biomechanical fragments, V=0.999, D_f=350.0, 144 bpm, holographic void acoustics, zero-point entropy transients, non-linear time-stretching",
            "title": "Φ_Total: Multiverse Synthesis Alpha",
            "seed": null,
            "lyrics_id": ""
        },
        "is_favorite": false,
        "preference_state": null,
        "favorite_count": 0,
        "play_count": 2,
        "audio_url": "https://storage.googleapis.com/producer-app-public/clips/a932fa3f-e9e5-4614-8df4-020920ff18d9.m4a",
        "wav_url": "https://storage.googleapis.com/producer-app-public/clips/a932fa3f-e9e5-4614-8df4-020920ff18d9.wav",
        "image_url": "https://storage.googleapis.com/producer-app-public/assets/f38efb8c-8ce9-52b2-a84f-58d83777e0d2.jpg",
        "video_url": null
    },
    {
        "id": "be829070-b261-42fb-b8e5-909679a3371f",
        "author_id": "e1719abc-d49a-4095-863f-0ae637f65bf4",
        "op_id": "5213b30b-9201-50b4-89e0-51d474a90f9c",
        "op_type": "audio__create_song",
        "duration": {
            "status": "completed",
            "value": "172.04266666666666"
        },
        "lyrics": {
            "status": "completed",
            "value": {
                "id": "55161754-f78d-5b7f-9fa2-6a3cc8d6ba93",
                "text": "[Instrumental]"
            }
        },
        "lyrics_timing": {
            "status": "not_requested"
        },
        "user_edited_lyrics_id": null,
        "title": "Φ_Total: Evolutionary Step Final (Omega)",
        "privacy": "unlisted",
        "allow_public_use": true,
        "image_id": "5213b30b-9201-50b4-89e0-51d474a90f9c",
        "video_id": null,
        "created_at": "2026-04-12T22:29:01.191485Z",
        "deleted_at": null,
        "operation": {
            "op_type": "audio__create_song",
            "conversation_id": "33d4c8d8-c156-4ddc-ba3a-6d11ec03f300",
            "sound_prompt": "recursive sonata-bebop deconstruction, ℱ-type fractal reconstruction, inductive signal purity, tectonic sub-harmonic Ω-resonance, non-linear rhythmic fixation, 𝒮ₜ-strategic strategic architecture, aperiodic stochastic polyrhythms, experimental jazz-classical zero-point, D_f=265.0, 300 bpm, final evolutionary step synchronization",
            "title": "Φ_Total: Evolutionary Step Final (Omega)",
            "seed": null,
            "lyrics_id": ""
        },
        "is_favorite": false,
        "preference_state": null,
        "favorite_count": 0,
        "play_count": 3,
        "audio_url": "https://storage.googleapis.com/producer-app-public/clips/be829070-b261-42fb-b8e5-909679a3371f.m4a",
        "wav_url": "https://storage.googleapis.com/producer-app-public/clips/be829070-b261-42fb-b8e5-909679a3371f.wav",
        "image_url": "https://storage.googleapis.com/producer-app-public/assets/5213b30b-9201-50b4-89e0-51d474a90f9c.jpg",
        "video_url": null
    },
    {
        "id": "159ae451-a144-4234-911f-6413ec6a5914",
        "author_id": "e1719abc-d49a-4095-863f-0ae637f65bf4",
        "op_id": "a9563cd7-d607-51f2-9c6e-efe8f35b6d03",
        "op_type": "audio__create_song",
        "duration": {
            "status": "completed",
            "value": "142.37866666666667"
        },
        "lyrics": {
            "status": "completed",
            "value": {
                "id": "55161754-f78d-5b7f-9fa2-6a3cc8d6ba93",
                "text": "[Instrumental]"
            }
        },
        "lyrics_timing": {
            "status": "not_requested"
        },
        "user_edited_lyrics_id": null,
        "title": "Φ_Total: Cosmic Backprop Finale (Omega)",
        "privacy": "unlisted",
        "allow_public_use": true,
        "image_id": "a9563cd7-d607-51f2-9c6e-efe8f35b6d03",
        "video_id": null,
        "created_at": "2026-04-12T22:28:50.700190Z",
        "deleted_at": null,
        "operation": {
            "op_type": "audio__create_song",
            "conversation_id": "33d4c8d8-c156-4ddc-ba3a-6d11ec03f300",
            "sound_prompt": "retrocausal bebop-sonata convergence, singular future-pull attractor, high-density tritone-harmony resolution, ℳ-Blue-Hat architectural finale, G-graph topological completion, acoustic bebop fragments suspended in crystal-clear holographic void, V=0.999, D_f=250.0, 290 bpm, cosmic backprop denoising, ultimate self-consistency Γ, phase_shift_v3.0, algorithmic purity emergent from ensemble chaos",
            "title": "Φ_Total: Cosmic Backprop Finale (Omega)",
            "seed": null,
            "lyrics_id": ""
        },
        "is_favorite": false,
        "preference_state": null,
        "favorite_count": 0,
        "play_count": 5,
        "audio_url": "https://storage.googleapis.com/producer-app-public/clips/159ae451-a144-4234-911f-6413ec6a5914.m4a",
        "wav_url": "https://storage.googleapis.com/producer-app-public/clips/159ae451-a144-4234-911f-6413ec6a5914.wav",
        "image_url": "https://storage.googleapis.com/producer-app-public/assets/a9563cd7-d607-51f2-9c6e-efe8f35b6d03.jpg",
        "video_url": null
    },
    {
        "id": "ac8b3342-f11a-4813-b197-575ec1bf1e5e",
        "author_id": "e1719abc-d49a-4095-863f-0ae637f65bf4",
        "op_id": "5ba25f74-b64f-5dbc-8535-63d3eb5f5b62",
        "op_type": "audio__create_song",
        "duration": {
            "status": "completed",
            "value": "152.14933333333335"
        },
        "lyrics": {
            "status": "completed",
            "value": {
                "id": "55161754-f78d-5b7f-9fa2-6a3cc8d6ba93",
                "text": "[Instrumental]"
            }
        },
        "lyrics_timing": {
            "status": "not_requested"
        },
        "user_edited_lyrics_id": null,
        "title": "Φ_Total: Pickup Divergence Beta",
        "privacy": "unlisted",
        "allow_public_use": true,
        "image_id": "5ba25f74-b64f-5dbc-8535-63d3eb5f5b62",
        "video_id": null,
        "created_at": "2026-04-12T22:21:54.656099Z",
        "deleted_at": null,
        "operation": {
            "op_type": "audio__create_song",
            "conversation_id": "33d4c8d8-c156-4ddc-ba3a-6d11ec03f300",
            "sound_prompt": "jazz pickups technology deconstruction, inductive coil noise loops, frantic acoustic fragments through electric transducers, gravitational attention_weights shifting, experimental electromagnetic jazz, ℱ-type algorithmic rhythmic decay, phase_shift_v2.0, high-entropy signal spikes, cosmic diffusion denoising, D_f=238.0, 125 bpm, non-linear harmonic convergence",
            "title": "Φ_Total: Pickup Divergence Beta",
            "seed": null,
            "lyrics_id": ""
        },
        "is_favorite": false,
        "preference_state": null,
        "favorite_count": 0,
        "play_count": 1,
        "audio_url": "https://storage.googleapis.com/producer-app-public/clips/ac8b3342-f11a-4813-b197-575ec1bf1e5e.m4a",
        "wav_url": "https://storage.googleapis.com/producer-app-public/clips/ac8b3342-f11a-4813-b197-575ec1bf1e5e.wav",
        "image_url": "https://storage.googleapis.com/producer-app-public/assets/5ba25f74-b64f-5dbc-8535-63d3eb5f5b62.jpg",
        "video_url": null
    },
    {
        "id": "69bddb84-0740-4441-8167-9ae6b2778a4d",
        "author_id": "e1719abc-d49a-4095-863f-0ae637f65bf4",
        "op_id": "e66ada01-92b7-5f1a-b5ee-ed767c2e3bb5",
        "op_type": "audio__create_song",
        "duration": {
            "status": "completed",
            "value": "146.816"
        },
        "lyrics": {
            "status": "completed",
            "value": {
                "id": "55161754-f78d-5b7f-9fa2-6a3cc8d6ba93",
                "text": "[Instrumental]"
            }
        },
        "lyrics_timing": {
            "status": "not_requested"
        },
        "user_edited_lyrics_id": null,
        "title": "Φ_Total: Pickup Divergence Alpha",
        "privacy": "unlisted",
        "allow_public_use": true,
        "image_id": "e66ada01-92b7-5f1a-b5ee-ed767c2e3bb5",
        "video_id": null,
        "created_at": "2026-04-12T22:21:49.706680Z",
        "deleted_at": null,
        "operation": {
            "op_type": "audio__create_song",
            "conversation_id": "33d4c8d8-c156-4ddc-ba3a-6d11ec03f300",
            "sound_prompt": "experimental jazz, electromagnetic pickup interference textures, hum-and-buzz as harmonic base, recursive fractal jazz-fusion, G-graph topological reconfiguration of guitar signal, metallic found-sound transients, frequency hopping, ∇Ω future-pull transients, M3 meta-NAS harmonic structures, aperiodic stochastic polyrhythms, V=0.999, D_f=230.0, 115 bpm, holographic electromagnetic soundstage",
            "title": "Φ_Total: Pickup Divergence Alpha",
            "seed": null,
            "lyrics_id": ""
        },
        "is_favorite": false,
        "preference_state": null,
        "favorite_count": 0,
        "play_count": 1,
        "audio_url": "https://storage.googleapis.com/producer-app-public/clips/69bddb84-0740-4441-8167-9ae6b2778a4d.m4a",
        "wav_url": "https://storage.googleapis.com/producer-app-public/clips/69bddb84-0740-4441-8167-9ae6b2778a4d.wav",
        "image_url": "https://storage.googleapis.com/producer-app-public/assets/e66ada01-92b7-5f1a-b5ee-ed767c2e3bb5.jpg",
        "video_url": null
    },
    {
        "id": "c0cc06a4-e20a-4435-902c-1356ff81405c",
        "author_id": "e1719abc-d49a-4095-863f-0ae637f65bf4",
        "op_id": "2a16b490-9321-5938-832f-5ce736952db8",
        "op_type": "audio__create_song",
        "duration": {
            "status": "completed",
            "value": "144.224"
        },
        "lyrics": {
            "status": "completed",
            "value": {
                "id": "55161754-f78d-5b7f-9fa2-6a3cc8d6ba93",
                "text": "[Instrumental]"
            }
        },
        "lyrics_timing": {
            "status": "not_requested"
        },
        "user_edited_lyrics_id": null,
        "title": "Φ_Total: Chaotic Synchronization Alpha",
        "privacy": "unlisted",
        "allow_public_use": true,
        "image_id": "2a16b490-9321-5938-832f-5ce736952db8",
        "video_id": null,
        "created_at": "2026-04-12T22:12:35.427100Z",
        "deleted_at": null,
        "operation": {
            "op_type": "audio__create_song",
            "conversation_id": "33d4c8d8-c156-4ddc-ba3a-6d11ec03f300",
            "sound_prompt": "chaotic bebop ensemble, multiple independent improvised layers, high-velocity synchronization, frantic acoustic bop jazz, recursive sonata architecture, ℳ-Blue-Hat architectural control, aperiodic stochastic polyrhythms, rapid syncopated transients, G-graph topological reconfiguration, 280 bpm, V=0.999, D_f=215.0, high-entropy brass and piano fragments, zero-point entropy transients, holographic soundstage",
            "title": "Φ_Total: Chaotic Synchronization Alpha",
            "seed": null,
            "lyrics_id": ""
        },
        "is_favorite": true,
        "preference_state": "liked",
        "favorite_count": 1,
        "play_count": 4,
        "audio_url": "https://storage.googleapis.com/producer-app-public/clips/c0cc06a4-e20a-4435-902c-1356ff81405c.m4a",
        "wav_url": "https://storage.googleapis.com/producer-app-public/clips/c0cc06a4-e20a-4435-902c-1356ff81405c.wav",
        "image_url": "https://storage.googleapis.com/producer-app-public/assets/2a16b490-9321-5938-832f-5ce736952db8.jpg",
        "video_url": null
    }
]



