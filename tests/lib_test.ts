import {
    assertEquals,
} from "https://deno.land/std/testing/asserts.ts";
import * as Degen from "../src/lib.ts";
import { Util } from "../src/util.ts";

Deno.test({
    name: "Util: DegenPath()",
    fn: () => {
        // Warning: This a side effect of openProjectConfig changing the current working directory
        // I need to fix the tests to restore the previous directory, but i havent done so yet
        const input = "tests/testdata/post.md";
        const expected: Degen.PathData = {
            full_path: `C:/Users/jakob/OneDrive/Desktop/github/Degen/tests/testdata/post.md`,
            dir: "C:/Users/jakob/OneDrive/Desktop/github/Degen/tests/testdata",
            file: "post.md",
            ext: ".md",
            name: "post"
        }

        const output = new Degen.DegenPath(input);
        assertEquals(output, expected);
    }
});