# Why I Built This

I built this project to explore how LLMs can be used for language learning applications.

> 中文说明：这个项目用于探索 AI 如何辅助中文用户学习外语，尤其是词汇、例句、翻译和语法解释这类高频学习场景。

# French Trainer

French Trainer is an AI-powered language learning tool designed to help Chinese-speaking learners study French more effectively.

The project focuses on practical language learning workflows: vocabulary learning, AI-generated example sentences, French translation, and grammar explanations. It uses the OpenAI API to generate contextual learning content and Streamlit to provide a simple interactive interface.

> 中文说明：French Trainer 是一个面向中文用户的法语学习工具，重点不是做复杂系统，而是验证 AI 在语言学习中的实际帮助。

## Features

- **Vocabulary Learning**  
  Learn and review French words with Chinese explanations.

- **AI-Generated Example Sentences**  
  Generate natural French example sentences based on selected words or user input.

- **French Translation**  
  Translate between Chinese and French to support reading and expression practice.

- **Grammar Explanation**  
  Explain French grammar points in Chinese to help learners understand sentence structure and usage.

> 中文说明：核心功能包括单词学习、AI 例句、法语翻译和中文语法解释。

## Tech Stack

- Python
- Streamlit
- OpenAI API

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/french-trainer.git
cd french-trainer
```

### 2. Create a Virtual Environment

```bash
python -m venv venv
```

Activate the virtual environment:

```bash
# macOS / Linux
source venv/bin/activate
```

```bash
# Windows
venv\Scripts\activate
```

### 3. Install Dependencies

```bash
pip install -r requirements.txt
```

### 4. Configure Environment Variables

Create a `.env` file in the project root:

```bash
OPENAI_API_KEY=your_openai_api_key
```

Do not commit your `.env` file to GitHub.

> 中文说明：真实 API Key 必须放在本地 `.env` 文件中，不要上传到公开仓库。

## Usage

Run the Streamlit application:

```bash
streamlit run app.py
```

Then open the local URL displayed in the terminal:

```text
http://localhost:8501
```

## Project Structure

```text
french-trainer/
├── app.py
├── requirements.txt
├── README.md
├── .env.example
├── .gitignore
└── assets/
    └── screenshots/
```

## Screenshots

### Home Page

![Home Page Screenshot](assets/screenshots/home.png)

### Vocabulary Learning

![Vocabulary Learning Screenshot](assets/screenshots/vocabulary.png)

### AI Example Generation

![AI Example Generation Screenshot](assets/screenshots/examples.png)

### Grammar Explanation

![Grammar Explanation Screenshot](assets/screenshots/grammar.png)

> 中文说明：截图可在后续补充，用于展示项目界面和核心学习流程。

## License

This project is licensed under the MIT License.

You are free to use, modify, and distribute this project, provided that the original license notice is included.

