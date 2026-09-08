import os
from openai import OpenAI

client = OpenAI(
    api_key="xpl_a80e421c3bb09b61061476c11345bcf64dad31b2",
    base_url="https://api.experientiallabs.ai/v1"
)

response = client.chat.completions.create(
    model="gpt-6-astra",
    messages=[
        {"role": "user", "content": "Hello! How are you?"}
    ]
)

print(response.choices[0].message.content)