import {
    assertEquals,
    assertThrowsAsync
} from "https://deno.land/std/testing/asserts.ts";
import * as Path from "https://deno.land/std@0.69.0/path/mod.ts";

import { Util } from "../src/util.ts";
import { Pages } from "../src/pages.ts"
import { TemplateError, TemplateVariableUndefined, Temple } from "../src/temple.ts"

const moduleDir = Path.dirname(Path.fromFileUrl(import.meta.url));
const testdataDir = Path.resolve(moduleDir, "testdata");

function ignoreWhiteSpace(str: string) {
    return str.replaceAll(/\n|\r|\t|[ ]{2,}/g, ""); // Assumes intentional spaces are of length 1, anything longer will be removed
}

Deno.test({
    name: "Temple: A simple string",
    fn: async () => {
        const string = "Simple string with no template var/expr";
        const expected = string;

        const config = await Util.openProjectConfig(Path.resolve(testdataDir, "base.toml"));
        const page_content = await Util.readFile(Path.join(testdataDir, "source/post.md"));
        const page = Pages.parsePage(page_content, Deno.realPathSync('source/post.md'), config);

        const result = Temple.renderString(string, page, new Pages.Compendium());
        assertEquals(result, expected, "Result should be unchanged.")
    }
});

Deno.test({
    name: "Temple: Template variable - title",
    fn: async () => {
        const string = "Insert title here: !{ title } ";
        const expected = "Insert title here: I am a post ";

        const config = await Util.openProjectConfig(Path.resolve(testdataDir, "base.toml"));
        const page_content = await Util.readFile(Path.join(testdataDir, "source/post.md"));
        const page = Pages.parsePage(page_content, Deno.realPathSync('source/post.md'), config);

        const result = Temple.renderString(string, page, new Pages.Compendium());
        assertEquals(result, expected, "Template Var Title should be replaced with the page content")
    }
});

Deno.test({
    name: "Temple: Template variable binds to undefined property",
    fn: async () => {
        const variable = "titl"
        await assertThrowsAsync(async () => {
            const string = `Insert title here: !{ ${variable} } `; // example - user miss-spelled title

            const config = await Util.openProjectConfig(Path.resolve(testdataDir, "base.toml"));
            const page_content = await Util.readFile(Path.join(testdataDir, "source/post.md"));
            const page = Pages.parsePage(page_content, Deno.realPathSync('source/post.md'), config);

            const result = Temple.renderString(string, page, new Pages.Compendium());
            // Error should be thrown 
        }, 
        TemplateVariableUndefined,
        `[T200] Template Variable '${variable}', binds to an undefined property`,
        "If a template variable is undefined, renderString() should throw an error.");
    }
});

Deno.test({
    name: "Temple: File - Render Empty Template",
    fn: async () => {
        const expected = ''

        const config = await Util.openProjectConfig(Path.resolve(testdataDir, "base.toml"));
        const page_content = await Util.readFile(Path.join(testdataDir, "source/post3.md"));
        const page = Pages.parsePage(page_content, Deno.realPathSync('source/post3.md'), config);

        const rendered = await Temple.render(page, new Pages.Compendium());
        assertEquals(ignoreWhiteSpace(rendered), expected);
    }
})

Deno.test({
    name: "Temple: File - Render Template Variables #1",
    fn: async () => {
        const expected = '<!DOCTYPE html><html lang="en"><head><title>I am a post</title></head><body>I am a post# Header 1HI This is another header## Header 2Html paragraph is here.### Footer - H3Fri Sep 18 2020 10:23:28 GMT-0400 (Eastern Daylight Time)</body></html>'

        const config = await Util.openProjectConfig(Path.resolve(testdataDir, "base.toml"));
        const page_content = await Util.readFile(Path.join(testdataDir, "source/post.md"));
        const page = Pages.parsePage(page_content, Deno.realPathSync('source/post.md'), config);

        const rendered = await Temple.render(page, new Pages.Compendium());
        assertEquals(ignoreWhiteSpace(rendered), expected);
    }
});

Deno.test({
    name: "Temple: File - Render Template Variables #2",
    fn: async () => {
        const expected = '<!DOCTYPE html><html lang=\"en\"><head><title>i am another post</title></head><body>I am another post another post I AM ANOTHER POST# Header 1HI This is another header## Header 2Html paragraph is here.### Footer - H3I AM ANOTHER POST was posted on Fri, 18 Sep 2020 15:31:07 GMT</body></html>'

        const config = await Util.openProjectConfig(Path.resolve(testdataDir, "base.toml"));
        const page_content = await Util.readFile(Path.join(testdataDir, "source/post2.md"));
        const page = Pages.parsePage(page_content, Deno.realPathSync('source/post2.md'), config);

        const rendered = await Temple.render(page, new Pages.Compendium());
        assertEquals(ignoreWhiteSpace(rendered), expected);
    }
});

// TODO add test for Template Variable Functions -- I need to finalize functionality/syntax of variable functions 

// TODO add test for template Expressions

// Deno.test({
//     name: "Temple: File - Render Template Expressions #1",
//     fn: async () => {
//         const config = await Util.openProjectConfig(Path.resolve(testdataDir, "base.toml"));
//         const markdown_page = await Util.readFile(Path.join(testdataDir, "source/post.md"));
//         const page = Header.parsePage(markdown_page, Deno.realPathSync('source/post.md'), config);
//     }
// });
