# Music Catalogue Example

This little example is a tiny music catalogue of albums and singles. I picked some of my most recent albums or singles that I enjoyed and whipped up this example using Degen.

## Point of Focus

One key part of this example is the usage of defining a link to the art cover of a single or album using the property name ```art_link``` in each page's header.

### Running the example

If you have repository open on your computer, do the following to generate an export of the example.

1. Move into the ```Degen/``` root folder.
2. Check you have the dependencies installed
    - Deno installed on user/computer.
    - markdown-it.js installed in a sub-folder called dependencies
        - The file path should look like ```Degen/dependencies/markdown-it.js```
3. Run Degen
    - ```deno run --allow-read --allow-write --allow-env --unstable .\src\degen.ts examples/catalogue/project.toml```

And that's it! You can view the rendered html pages in the project's (aka the example's) export folder.
  
If you use VS Code, you can also hook up the live server extension and set live server's root folder to the the project's export folder.

### Additions that could be made

- You probably don't want to use the same template for albums and singles, or at the very least change the name of the template to better represent it is used by both. This was just a bad design decision. If you want, you can always fix it yourself :stuck_out_tongue_winking_eye:.
- Define a default ```art_link``` property for each page in ```project.toml```.
  - If a single / album has no art cover then you could display a default image.
  - Currently, if a page doesn't have an ```art_link``` property defined in their header, Degen will through an error because it can't find the property during rendering.

These additions are left unfixed so they can be used as **learning exercises for someone who wants to try out Degen.**

## Something to note

I would not use Degen - a static site generator - to create a music catalogue. Unless you happen to update your own catalogue infrequently. A music catalogue, would most likely update multiple times a day and possibly be handled by multiple Vendors / Managements. This is something better handled by a DBMS with a simplified and secure API with CRUD functionality.

It just so happens that I really enjoy music and I thought this was a quick and easy example.
