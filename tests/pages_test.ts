import {
    assertEquals,
    assertStringContains,
    assertThrows,
    assertThrowsAsync,
} from "https://deno.land/std/testing/asserts.ts";
import * as Path from "https://deno.land/std@0.69.0/path/mod.ts";

import { Util } from "../src/util.ts";
import { Pages } from "../src/pages.ts"

const moduleDir = Path.dirname(Path.fromFileUrl(import.meta.url));
const testdataDir = Path.resolve(moduleDir, "testdata");

Deno.test({
    name: "Pages - Create Page from Empty Page",
    fn: async () => {
        const config = await Util.openProjectConfig(Path.resolve(testdataDir, "base.toml"));
        const page_content = await Util.readFile(Path.join(testdataDir, "source/post_empty.md"));

        await assertThrowsAsync(async () => {
            const page = Pages.parsePage(page_content, Deno.realPathSync('source/post_empty.md'), config);
            console.log(page.getData());
        },
        Error,
        "Degen was given an empty page to parse:",
        "");
    }
});

Deno.test({
    name: "Pages - Create Page from Page with no header",
    fn: async () => {
        const config = await Util.openProjectConfig(Path.resolve(testdataDir, "base.toml"));
        const page_content = await Util.readFile(Path.join(testdataDir, "source/post_no_header.md"));

        await assertThrowsAsync(async () => {
            const page = Pages.parsePage(page_content, Deno.realPathSync('source/post_no_header.md'), config);
            console.log(page.getData());
        },
        Error,
        "Page header is not formatted correctly:",
        "");
    }
});

Deno.test({
    name: "Header - Split Markdown Page Meta Tags and Body",
    fn: async () => {
        const expected_header = {
            post: {
                is_public: true,
                title: "I am a post"
            }
        };
        const expected_markdown = "\r\n# Header 1\r\n\r\nHI\r\n\r\n## Header 2\r\n\r\nHtml paragraph is here.\r\n\r\n### Footer - H3\r\n";
        
        const markdown_page = await Util.readFile(Path.join(testdataDir, "post.md"));
        const {toml_header, markdown} = Pages.splitTomlHeaderAndMarkdown(markdown_page, Path.join(testdataDir, "post.md"));

        assertEquals(toml_header, expected_header);
        assertEquals(markdown, expected_markdown);
    }
});

Deno.test({
    name: "Pages - Create a Page",
    fn: async () => {
        const expected_data = {
            is_public: true,
            title: "I am a post",
            filename: "post.md",
            page_path: "C:/Users/jakob/OneDrive/Desktop/github/Degen/tests/testdata/source/post.md",
            page_type: "post",
            base_export_path: "C:/Users/jakob/OneDrive/Desktop/github/Degen/tests/testdata/export",
            base_source_path: "C:/Users/jakob/OneDrive/Desktop/github/Degen/tests/testdata/source",
            markdown:  "\r\n# Header 1\r\n\r\nHI This is another header\r\n\r\n## Header 2\r\n\r\nHtml paragraph is here.\r\n\r\n### Footer - H3\r\n",
            template: "source/simple_template.html",
            date: new Date("2020-09-18T14:23:28.094Z"),
            export_path: "C:/Users/jakob/OneDrive/Desktop/github/Degen/tests/testdata/export/post.html",
            url: "/post.html"
        };
        
        const config = await Util.openProjectConfig(Path.resolve(testdataDir, "base.toml"));
        const markdown_page = await Util.readFile(Path.join(testdataDir, "source/post.md"));

        const page = Pages.parsePage(markdown_page, Deno.realPathSync('source/post.md'), config);
        assertEquals(page.getData(), expected_data);
    }
});
