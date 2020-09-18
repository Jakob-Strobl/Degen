import {
    assertEquals,
    assertStringContains,
    assertThrows,
} from "https://deno.land/std/testing/asserts.ts";
import * as Path from "https://deno.land/std@0.69.0/path/mod.ts";

import { Util } from "../src/util.ts";
import { Header } from "../src/header.ts";

const moduleDir = Path.dirname(Path.fromFileUrl(import.meta.url));
const testdataDir = Path.resolve(moduleDir, "testdata");

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
        const {toml_header, markdown} = Header.splitTomlHeaderAndMarkdown(markdown_page);

        assertEquals(toml_header, expected_header);
        assertEquals(markdown, expected_markdown);
    }
});

Deno.test({
    name: "Header - parsePage()",
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

        const page = Header.parsePage(markdown_page, Deno.realPathSync('source/post.md'), config);
        assertEquals(page.getData(), expected_data);
    }
});