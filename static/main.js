class Source extends Atom {

}

class HomePage extends Component {
    init() {
        this.data = new Source({text: "", password: "", id: ""});
        this.handleInputDown = this.handleInputDown.bind(this);
        this.handleKeyDown = (evt) => this.handleInputDown("text", evt);
        this.handleIDInput = (evt) => this.handleInputDown("id", evt);
        this.handlePassword = (evt) => this.handleInputDown("password", evt);
        this.bind(this.data);
    }


    handleInputDown(element, evt) {
        this.data.update({[element]: evt.target.value});
    }

    styles() {
        return css`
            .markdown {
                width: 100%;
                position: relative;
                display: flex;
            } 
        `
    }

    create({text, password, id}) {
        return html`<div class="home">
             <h1>Curate a list!</h1>
             <input oninput=${this.handleIDInput} value=${id} placeholder="Enter the ID or title of the page"/>
             <input oninput=${this.handlePassword} value=${password} placeholder="Enter password"/>
             <p>Enter the markdown copy of the desired list</p>
             <div class="markdown">
                <textarea oninput=${this.handleKeyDown} class="unit" placeholder="Define the item of your list" value=${text}></textarea>
                <pre class="p-heights ${text.endsWith("\n") ? "endline" : ""}">${text}</pre>
             </div>
         </div>`
    }
}
class App extends Component {
    init() {
        this.home = new HomePage();
    }

    create() {
        return html`<main>
            ${this.home.node}
            <footer>Built with <a href="https://github.com/amirgamil/poseidon">Poseidon</a> by <a href="https://amirbolous.com/">Amir</a></footer>
        </main>` 
    }
}

const app = new App();
document.body.appendChild(app.node);