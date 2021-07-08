class HomePage extends Component {
    init() {

    }

    create() {
         return html`<div>
             <h1></h1>
             <input placeholder="Enter password"/>
             <p>Enter the markdown copy of the desired list</p>
             <textarea></textarea>
             <pre></pre>
         </div>`
    }
}
class App extends Component {
    init() {
        //initalize stuff here
    }

    create() {
        return html`<main>

            <footer>Built with <a href="https://github.com/amirgamil/poseidon">Poseidon</a> by <a href="https://amirbolous.com/">Amir</a></footer>
        </main>` 
    }
}

const app = new App();
document.body.appendChild(app.node);