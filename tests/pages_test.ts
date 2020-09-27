import {
    assertEquals,
    assertStringContains,
    assertThrows,
    assertThrowsAsync,
} from "https://deno.land/std/testing/asserts.ts";
import * as Path from "https://deno.land/std@0.69.0/path/mod.ts";

import { DegenPath } from "../src/lib.ts";
import { Util } from "../src/util.ts";
import { Pages } from "../src/pages.ts"

const moduleDir = Path.dirname(Path.fromFileUrl(import.meta.url));
const testdataDir = Path.resolve(moduleDir, "testdata");
const original_dir = Deno.realPathSync(Deno.cwd());

Deno.test({
    name: "Pages - Create Page from Empty Page",
    fn: async () => {
        const config = await Util.openProjectConfig(new DegenPath(Path.resolve(testdataDir, "base.toml")));
        const page_content = await Util.readFile(new DegenPath(Path.join(testdataDir, "source/post_empty.md")));

        await assertThrowsAsync(async () => {
            const page = Pages.parsePage(page_content, new DegenPath('source/post_empty.md'), config);
            console.log(page.getData());
        },
        Pages.PageError,
        "[P101] Degen was given an empty page to parse",
        "Degen should throw an error when given an empty page to parse.");
        Deno.chdir(original_dir); // go back to original working directory 
    }
});

Deno.test({
    name: "Pages - Create Page from Page with no header",
    fn: async () => {
        const config = await Util.openProjectConfig(new DegenPath(Path.resolve(testdataDir, "base.toml")));
        const page_content = await Util.readFile(new DegenPath(Path.join(testdataDir, "source/post_no_header.md")));

        await assertThrowsAsync(async () => {
            const page = Pages.parsePage(page_content, new DegenPath('source/post_no_header.md'), config);
            console.log(page.getData());
        },
        Pages.PageError,
        "[P102] Page header is not formatted correctly",
        "Each page requires a header in order to work in the render pipeline.");
        Deno.chdir(original_dir); // go back to original working directory 
    }
});

Deno.test({
    name: "Pages - Split Markdown Page Meta Tags and Body",
    fn: async () => {
        const expected_header = {
            post: {
                is_public: true,
                title: "I am a post"
            }
        };
        const expected_markdown = "\r\n# Header 1\r\n\r\nHI\r\n\r\n## Header 2\r\n\r\nHtml paragraph is here.\r\n\r\n### Footer - H3\r\n";
        
        const markdown_page = await Util.readFile(new DegenPath(Path.join(testdataDir, "post.md")));
        const {toml_header, markdown} = Pages.splitTomlHeaderAndMarkdown(markdown_page, new DegenPath(Path.join(testdataDir, "post.md")));

        assertEquals(toml_header, expected_header);
        assertEquals(markdown, expected_markdown);

    }
});

Deno.test({
    name: "Pages - Create a Page",
    fn: async () => {
        const expected_data = {
            path: {
                dir: "C:/Users/jakob/OneDrive/Desktop/github/Degen/tests/testdata/source",
                ext: ".md",
                file: "post.md",
                full_path: "C:/Users/jakob/OneDrive/Desktop/github/Degen/tests/testdata/source/post.md",
                name: "post",
            },
            template: {
                dir: "C:/Users/jakob/OneDrive/Desktop/github/Degen/tests/testdata/source",
                ext: ".html",
                file: "simple_template.html",
                full_path: "C:/Users/jakob/OneDrive/Desktop/github/Degen/tests/testdata/source/simple_template.html",
                name: "simple_template",
            },
            export_path: {
                dir: "C:/Users/jakob/OneDrive/Desktop/github/Degen/tests/testdata/export",
                ext: ".html",
                file: "post.html",
                full_path: "C:/Users/jakob/OneDrive/Desktop/github/Degen/tests/testdata/export/post.html",
                name: "post",
            },
            project_export_path: "C:/Users/jakob/OneDrive/Desktop/github/Degen/tests/testdata/export",
            project_source_path: "C:/Users/jakob/OneDrive/Desktop/github/Degen/tests/testdata/source",
            is_public: true,
            title: "I am a post",
            page_type: "post",
            markdown:  "\r\n# Header 1\r\n\r\nHI This is another header\r\n\r\n## Header 2\r\n\r\nHtml paragraph is here.\r\n\r\n### Footer - H3\r\n",
            date: new Date("2020-09-18T14:23:28.094Z"),
            domain_url: "http://127.0.0.1",
            url: "http://127.0.0.1/post.html"
        };
        
        const config = await Util.openProjectConfig(new DegenPath(Path.resolve(testdataDir, "base.toml")));
        const markdown_page = await Util.readFile(new DegenPath(Path.join(testdataDir, "source/post.md")));

        const page = Pages.parsePage(markdown_page, new DegenPath(Deno.realPathSync('source/post.md')), config);
        assertEquals(page.getData(), expected_data);
    }
});
