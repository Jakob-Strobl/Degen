# Degen Examples

## The goal of the examples

The examples try to find a good balance between showcasing functionality and simplicity. I hope you will be able to understand an example halfway through drinking a small coffee.
  
Just because an example exists doesn't mean I recommend making that type of website using Degen ([see catalogue](https://github.com/Jakob-Strobl/Degen/tree/master/examples/catalogue)).

## How to get the most out of the examples

To quickly get a good idea of what is going on with the example I recommend reading the files in the following order:

1. Read the project config file - the .toml file in the root directory of each example.
    - Read the source and export paths defined
    - Check what directories are defined in passthrough
    - Read the defined page types and their default values
2. Look at the index.md page (this is the index.html page for the rendered site)
    - Read the type of page it is by looking at the toml table defined in the page's header
3. Read the index.md's template and then read the other templates.
4. Read through the rest of the markdown pages in the source directory
    - Good to make a mentle note where data is defined and how it is accessed

**NOTE:** For now, I recommend reading the markdown pages using the **RAW** view on Github. It will be easier to read the page headers that way.

Once you understand the structure of one example, the rest should be easier to pick up.

Each example will also have their own README. Any unique qualities or key points of an example will hopefully be explained there.
