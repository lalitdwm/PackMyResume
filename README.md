# RecPDF

RecPDF is a frontend-only app that creates a first-page candidate profile and appends the uploaded resume PDF after it.

## Features

- Paste candidate details in `Label:` followed by value format
- Upload a candidate photo
- Upload a resume PDF
- Preview the first page in the browser
- Generate one merged PDF entirely on the client side

## Run

Recommended:

```bash
cd /Users/lalit-kumar/Documents/RecPDF
python3 -m http.server 8000
```

Then open [http://localhost:8000](http://localhost:8000).

Why:
- The app is pure frontend with no backend
- It loads `pdf-lib` from a CDN in the browser
- Opening `index.html` directly with `file://` can trigger browser security restrictions

If you want a fully offline version later, we can vendor the PDF library locally too.

## Input format

Example:

```text
Name as per PAN Card:
Ram

Total years of Exp:
3.6 Years

Relevant Exp:
3.6 Years
```

Parsing rules:

- A line ending with `:` is treated as a label
- The next non-empty line becomes its value
- Inline `Label: Value` lines are also supported
- Empty lines are ignored
