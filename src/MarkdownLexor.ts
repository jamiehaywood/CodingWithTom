import marked from "marked"
import { first, rest, chain } from "underscore"
import matchAll from "match-all"

class GroupedMarkdownLex {
    start : marked.TokensList;
    data : marked.TokensList;

    get children() : GroupedMarkdownLex[] {
        
        return MarkdownLexor.SplitByHeading(2, this.data);
    }

    constructor(data : marked.TokensList, start? : marked.TokensList) {
        this.start = start;
        if (this.start)
            this.start.links = {};
        this.data = data;
        if (this.data)
            this.data.links = {};
    }
}

interface GroupedObj {
    summary: string,
    objectives: GroupedObj[],
    markdown: string,
    text: string
}

export default class MarkdownLexor {

    static SplitByHeading(depth : number, array : marked.TokensList) : Array<GroupedMarkdownLex> {

        let start : number = null;

        let groups : GroupedMarkdownLex[] = [];

        for (let i=0;i<array.length;i++) {

            let curr = array[i];

            if (curr.type == "heading" && curr.depth != null) {

                if (start == null) {

                    if (i > 0) {
                        groups.push(new GroupedMarkdownLex(chain(array).first(i).value()));
                    }

                    start = i;
                } else if (curr.depth == depth) {

                    groups.push(new GroupedMarkdownLex(
                        chain(array).rest(start + 1).first(i-(start + 1)).value(),
                        chain(array).rest(start).first(1).value()
                    ));

                    start = i;
                }
            }
        }

        if (start != null) {
            groups.push(new GroupedMarkdownLex(
                chain(array).rest(start + 1).first(array.length-(start + 1)).value(),
                chain(array).rest(start).first(1).value()
            ));
        }

        return groups;
    }

    static escapeHtml(html : string) {
        var text = document.createTextNode(html);
        var p = document.createElement('p');
        
        p.appendChild(text);

        return p.innerHTML;
    }

    static RenderMarkdown(markdown : string) : string {

        let renderer = new marked.Renderer();

        renderer.code = (text : string, language : string) => {

            // Diff
            if (/`{3}vs/.test(text)) {

                let left = matchAll(text, /([\s|\S]*)\n```vs/gi).toArray()[0];
                let right = matchAll(text, /```vs\n([\s|\S]*)/gi).toArray()[0];

                var escapedTextLeft = this.escapeHtml(left);
                var escapedTextRight = this.escapeHtml(right);

                return `<MonicoCode language='${language}' mode="diff"><div id="left" v-pre>${escapedTextLeft}</div><div id="right" v-pre>${escapedTextRight}</div></MonicoCode>`;
            } else {
                let escapedText = this.escapeHtml(text);

                return `<MonicoCode language='${language}'><div v-pre>${escapedText}</div></MonicoCode>`;
            }
        };
        
        return marked.parser(markdown, {
            renderer: renderer
        });
    }

    static GroupsToObj(obj : GroupedMarkdownLex) : GroupedObj {

        let summary = obj.start != null ? this.RenderMarkdown(obj.start) : null;

        let objectives = obj.children.length > 0 ? obj.children.map(i=>this.GroupsToObj(i)) : null;

        let text = obj.children.length == 0 ? this.RenderMarkdown(obj.data) : null;

        return {
            summary: summary,
            objectives: objectives,
            markdown: obj.data,
            text: text
        } as GroupedObj;
    }

    static Parse(text : string) {

        // Here I think it'd be best to convert the markdown into json, then work with it.
        // Although there a small argument that markdown isn't the correct format in the first place.

        if (text == null)
            return null;
        
        try {

            let lexer = new marked.Lexer();

            let lex : marked.TokensList = lexer.lex(text);
            
            let groups = this.SplitByHeading(1, lex);

            if (groups.length > 0) {
                let obj = this.GroupsToObj({
                    children: groups.filter(i=>i.start != null),
                    start: (groups.filter(i=>i.start == null)[0]).data,
                    data: []
                });
            } else {
                return {
                    summary: this.RenderMarkdown(lex),
                    objectives: [],
                    markdown: "",
                    text: ""
                }
            }

            return obj;
        }
        catch (ex) {
            console.warn("Couldn't process markdown, leaving tutorial", ex);
            return null;
        }
    }
}