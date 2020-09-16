# Degen

A Declarative static site generator using Deno and TypeScript

## Version: **Beta 1**

Versions increment in whole numbers.  
Degen will exit Beta probably around the time I finish my website.

## Brief

Degen is a simple static site generator written in TypeScript and uses Deno as the runtime environment.  
The code is open source in case anyone might find it useful.

## Motivation

I wanted to use a static site generator for creating my portfolio website. After looking and the available SSGs online, I decided to make my own. I created Degen out of pure curiosity, interest, and for the experience. I also wanted to build a project using the new and fresh Deno runtime.  
Any changes to Degen while building my portfolio will be reflected here.

If you happen to find this, I recommend the using other static site generators:

- Eleventy
- Hugo
- Gatsby
- Jekyll
- and other SSGs I have failed to mention

## Using Degen

### Dependencies

Degen has two dependencies:

1. Deno
2. Markdown-it (Likely to change if I find a Native Deno Module)

### Execution

1. Configure the degen.toml file to fit the structure of your project
    - e.g. change source_directory and export_path
2. Run Degen
    - ```deno run --allow-read --allow-write --allow-env .\degen.ts```

Currently, we need the flags --allow-read --allow-write --allow-env.

--allow-read --allow-write: Read markdown, template, and other files and write out rendered HTML files.  
--allow-env: This is used by Deno's ```require()``` (Node-compatibility interface), which is needed to use markdown-it Node module.

### Current Issues

- Need to clean up Error creation
- Update my tests
- Add more tests
- Resolve all TODOs
- And the other issues on my Trello board
