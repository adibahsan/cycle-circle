# Section template

Every feature section in a chapter uses these headings, in this order, at the level shown (the build shifts them down by one; the filter gives each an id `<section anchor>--<heading slug>` so other chapters can link to it, for example `#gs-phone-login--what-can-go-wrong`).

Copy this block for a new section. The section heading carries the anchor from [OUTLINE.md](OUTLINE.md).

````markdown
## Phone login with a BDApps OTP {#gs-phone-login}

### What it is

One or two sentences in plain words. Use the glossary terms (User, Admin, Pro, App OTP...).

### Where to find it

Navigation path, for example **More > Settings > Replay app tour**, and the screenshot:

![Login screen with the phone field](../screenshots/gs-phone-login.png)

### How to use it

1. Numbered steps, one action each. Quote button and field labels exactly as the English UI shows them, in **bold** ("Send OTP").
2. ...

### Rules and limits

- Every number, time limit and rule, taken from the code. Times in Bangladesh time.

### What can go wrong

| The User sees | Cause | Fix |
|---|---|---|
| "Invalid or expired code. Please try again." | ... | ... |

### Related

- Admin screen: [Users](#us-detail)
- Automatic job: [Daily subscription check](#sj-sub-check)
````

## Rules

- **Voice.** English only. Say User and Admin, never "customer" or "client". Say Subscriber only when BDApps billing matters. Other terms follow [GLOSSARY.md](../../GLOSSARY.md); a new term goes into the glossary first.
- **Labels.** Quote UI text exactly as it appears in the English UI. Message text in the "What can go wrong" table is copied from the English locale, not paraphrased.
- **Source of truth.** The current production code. When an older doc or the UI's own copy disagrees with what the code does, write what the code does and say so in the section ("The page says X; the system actually does Y").
- **Times** are Bangladesh time (Asia/Dhaka, UTC+6). Days are Bangladesh days (ADR 0008).
- **Screenshots.** Image path is `../screenshots/<file>.png` from a chapter file. Alt text says what the screen shows. A section that has no screen of its own says so in "Where to find it" and the outline row still keeps its file name.
- **Related.** Link with a plain `#anchor` taken from [OUTLINE.md](OUTLINE.md). A link to a section that is still a placeholder is fine; the final gate (#251) checks every link.
- **Placeholders.** A section that is not written yet contains only the line `> Placeholder: ...`. Replace the whole section, heading anchor included, when you write it.
- **Do not** edit the generated HTML by hand, rename an anchor, or reorder chapters (the order is in [index.md](index.md)).
