# Page snapshot

```yaml
- generic [ref=e4]:
  - img "Phone image" [ref=e6]
  - generic [ref=e7]:
    - generic [ref=e8]:
      - paragraph [ref=e9]: Login
      - generic [ref=e10]:
        - generic [ref=e11]:
          - generic [ref=e12]: 
          - text: "Username :"
        - textbox " Username :" [ref=e13]:
          - /placeholder: enter your e-mail
      - generic [ref=e14]:
        - generic [ref=e15]:
          - generic [ref=e16]: 
          - text: "Password :"
        - textbox " Password :" [ref=e17]:
          - /placeholder: enter your password
      - button "login" [ref=e19] [cursor=pointer]
    - paragraph [ref=e20]:
      - text: i don't have any account
      - link "Register Here" [ref=e21] [cursor=pointer]:
        - /url: http://localhost:8000/register
```