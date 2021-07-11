class UnitOfList extends Atom {

}


class Store extends CollectionStoreOf(UnitOfList) {
    fetch(listKey) {
        return fetch("/getList/" + listKey)
               .then(data => data.json())
               .then(response => {
                   if (response.data) {
                       this.setStore(response.data.map(element => new UnitList(element)));
                   } else {
                        this.setStore([]);                        
                   }
                   //return key and the rule as an object to allow caller to assign appropriately
                   //when initializing our list
                   return {key: response.key, rule: response.rule};
               })
               .catch(ex => {
                   console.log("Error fetching list data: ", ex);
               })
    }

    save(newItem) {
        return fetch("/updateList/" + listKey, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(newItem)
        }).then(data => data.json())
           .then(response => {
                if (!response.ok) Promise.reject(response);
           }).catch(ex => {
                //TODO: do stuff
           })
    }
}


class UnitList extends Component {
    init(data, removeCallBack) {
        this.data = data;
        this.removeCallBack = removeCallBack;
    }

    create(data) {
        return html`<p>${data}</p>`
    }
}

class CreatedList extends ListOf(UnitList) {
    // create() {
    //     return html`${this.rule ? html`<div>
    //         ${this.nodes}
    //     </div>` : html`<p>Loading...</p>`}`
    // }
}

function getErrorMessageFromCode(code) {
    switch (code) {
        case 401:
            return "Uh oh, what do we have here, enter the right password or be gone!"
            break
        case 405: 
            return "Uh oh, this ID already exists, try a different one?" 
            break
        default:
            return "Uh oh, an unexpected error occurred"
    }
}

//higher order component for representing a dynamic list and data source
class ListView extends Component {
    init(route) {
        this.dataSource = new Store();
        this.list = new CreatedList(this.dataSource)
        this.newItem = "";
        //TODO: handle error occurred modal? any way to do this without repeating code?
        this.errorOccurred = "";
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.addListItem = this.addListItem.bind(this);
        this.dataSource.fetch(route)
                        .then(data => {
                            const {key, rule} = data;
                            this.key = key;
                            this.newItem = rule;
                            this.bind(this.dataSource);
                        });
    }

    addListItem() {
        fetch("/updateList/" + this.key, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(this.newItem)
        }).then(response => {
            if (response.ok) {
                return response.json()
            } else {
                return Promise.reject(response);
            }
        }).then(data => {
            console.log(data);
            //add new element to our store once guaranteed it has been updated in the database
            this.dataSource.add(data);
          }).catch(ex => {
            this.errorOccurred = getErrorMessageFromCode(ex.status);
            console.log("Error adding new item: ", this.errorOccurred, " ", ex);
            this.render();
          })
    }

    handleKeyDown(evt) {
        this.newItem = evt.target.value;
        this.render();
    }

    create() {
        return html`<div class="colWrapper">
            ${this.list.node}
            ${this.newItem ? html`<div class="markdown">
                <textarea oninput=${this.handleKeyDown} class="unit" placeholder="Define the item of your list" value=${this.newItem}></textarea>
                <pre class="p-heights ${this.newItem.endsWith('\n') ? 'endline' : ''}">${this.newItem}</pre>
            </div> ` : html`<p>Loading</p>`}
            <button onclick=${this.addListItem}>+</button>
        </div>
        `
    }
}

class Source extends Atom {

}

class HomePage extends Component {
    init() {
        this.data = new Source({text: "", password: "", id: ""});
        this.errorOccurred = "";
        this.handleInputDown = this.handleInputDown.bind(this);
        this.handleKeyDown = (evt) => this.handleInputDown("text", evt);
        this.handleIDInput = (evt) => this.handleInputDown("id", evt);
        this.handlePassword = (evt) => this.handleInputDown("password", evt);
        this.createList = this.createList.bind(this);
        this.getMarkdownData = this.getMarkdownData.bind(this);
        this.closeModal = this.closeModal.bind(this);
        this.bind(this.data);
    }


    handleInputDown(element, evt) {
        this.data.update({[element]: evt.target.value});
    }

    //returns a promise to get the rendered markdown of the content defined in the list component
    getMarkdownData() {
        return fetch("/data", {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(this.data.get("text"))
        }).then(data => data.json())
          .then(data => {
          }).catch(ex => {
              console.log("Error fetching markdown: ", ex);
          }); 
    }

    //main logic for creating a list    
    createList() {
        this.getMarkdownData();
        //show modal and do some intermediate steps
        //create key in database
        fetch("/createList/" + this.data.get("id"), {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                rule: this.data.get("text"),
                password: this.data.get("password")
            })
        }).then(res => {
            if (res.ok) {
                //change the location of the window as opposed to just navigating with the 
                //router since we need the parent component to re-render not just this one
                window.location = "/" + this.data.get("id");
            } else {
                return Promise.reject(res);
            }
        })
        .catch(e => {
            this.errorOccurred = getErrorMessageFromCode(e.status);
            this.render();
        })
    }

    styles() {
        return css`
             
            .modal {
                position: fixed;
                z-index: 5;
                background-color: var(--bg);
                opacity: 0.95;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .modal-content {
                width: 300px;
                padding: 20px !important;
                margin: 0 auto;
                border: 1px solid black;
            }
        `
    }

    closeModal(evt) {
        this.errorOccurred = "";
        this.render();
    }

    create({text, password, id}) {
        return html`<div class="colWrapper">
             <h1>Curate a list!</h1>
             <form>
                <input oninput=${this.handleIDInput} value=${id} placeholder="Enter the ID or title of the page"/>
                <input oninput=${this.handlePassword} value=${password} placeholder="Enter password" type="password" autocomplete="current-password"/>
             </form>
             <p>Enter the markdown copy of the desired list</p>
             <div class="markdown">
                <textarea oninput=${this.handleKeyDown} class="unit" placeholder="Define the item of your list" value=${text}></textarea>
                <pre class="p-heights ${text.endsWith('\n') ? 'endline' : ''}">${text}</pre>
             </div>
            <button onclick=${this.createList}>Create</button>
            ${this.errorOccurred !== "" ? html`<div class = "modal"> 
                    <div class="modal-content">
                        <p>${this.errorOccurred}</p>
                        <button onclick=${this.closeModal}>Close</button>
                    </div>
                </div>` : null}
         </div>`
    }
}
class App extends Component {
    init() {
        this.list = null;
        this.router = new Router();
        this.route = "/"
        this.router.on({
            route: "/:list", 
            handler: (route) => {
                this.route = route;
                this.listView = new ListView(route);
        }});

        this.router.on({
            route: "/",
            handler: () => {
                this.route = "/";
                this.home = new HomePage();
            }
        })
    }

    create() {
        return html`<main>
            ${() => {
                switch (this.route) {
                    case "/":
                        return this.home.node;
                    default: 
                        //we have a list
                        return this.listView.node;

                }
            }}
            <footer>Built with <a href="https://github.com/amirgamil/poseidon">Poseidon</a> by <a href="https://amirbolous.com/">Amir</a></footer>
        </main>` 
    }
}

const app = new App();
document.body.appendChild(app.node);