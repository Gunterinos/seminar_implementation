# About 

This repo aims to implement an educational tool for the paper DimBridge: Interactive Explanation of Visual Patterns in Dimensionality Reductions with Predicate Logic, which can be found [here](https://arxiv.org/abs/2404.07386).

# Setup Instructions

Use your preferred package manager; in my case, I am using [uv](https://docs.astral.sh/uv/getting-started/installation/).

Open a terminal in the root folder and run:

```
uv venv
uv pip install -r requirements.txt
```

# Run Instructions

To run the system, you will need to start both the backend and the frontend.

## Starting the Backend

1. In the terminal, navigate to `.venv/Scripts/` and activate your virtual environment:
   - On Command Prompt: `activate.bat`
   - On PowerShell: `activate.ps1`
2. Navigate back to the root, then go to the `backend` folder and run:
   ```
   python app.py
   ```

## Starting the Frontend

You have two options:

1. **Using VS Code Live Server Extension:**
   - Open the project in VS Code.
   - Install the Live Server extension.
   - Right-click `index.html` in the `frontend` folder and select **Open with Live Server**.

2. **Using Python HTTP Server:**
   - In the terminal, navigate to the `frontend` folder.
   - Run:
     ```
     python -m http.server 8000
     ```
   - Open [http://localhost:8000](http://localhost:8000) in your browser.

After completing these steps, you should be able to use the system.

# External Resources

- `external_code/predicate.py`: Contains the computation logic for the predicate. This code was extracted from [this repository](https://github.com/tiga1231/dim-bridge).
- `external_code/datasets`: Contains the datasets used in the paper, namely `animals5.csv` and `gait2.csv`. They were extracted from the same repository as mentioned before.
