// only fire fn once it hasn't been called in delay ms
const debounce = (fn, delay) => {
    let to = null;
    return (...args) => {
        const bfn = () => fn(...args);
        clearTimeout(to);
        to = setTimeout(bfn, delay);
    }
}

class UnitOfList extends Atom {

}


class Store extends CollectionStoreOf(UnitOfList) {
    fetch(listKey) {
        return fetch("/getList/" + listKey)
               .then(data => data.json())
               .then(response => {
                   if (response.data) {
                       this.setStore(response.data.map(element => new UnitOfList(element)));
                   } else {
                        this.setStore([]);                        
                   }
                   //when initializing our list
                   return {key: response.key, rule: response.rule};
               })
               .catch(ex => {
                   console.log("Error fetching list data: ", ex);
               })
    }
}


class UnitList extends Component {
    init(data, removeCallBack) {
        this.data = data;
        this.removeCallBack = removeCallBack;
    }

    removeItem() {
        this.removeCallBack(this.data);
    }

    create(data) {
        //we don't sanitize data here since we will have sanitized it and cleaned it up
        //before storing it in the database, so we can assume it's already safe
        return html`<div class="unitList" innerHTML=${data}>
            </div>`
    }
}

class CreatedList extends ListOf(UnitList) {
    create() {
        return html`<div class="colWrapper userList">
            ${this.nodes}
        </div>`;
    }
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
//global helper methods for rendering markdown that are reused across components
//takes an optional boolean parameter that determines whether it should call render
//or whether this is handled by the caller component
function updateMarkdown(shouldNotRender) {
    this.id = setInterval(() => {
        if (this.shouldUpdatePreview) {
            if (this.newItem) {
                getMarkdownData(this.newItem)
                    .then(data => {
                        this.preview = data;
                        this.shouldUpdatePreview = false;
                        if (!shouldNotRender) this.render();
                    }).catch(ex => {
                        //set to false to avoid infinite loops
                        this.shouldUpdatePreview = false;
                        //if an exception happens, we still want to render the updated text of the text area
                        this.render();
                    })
            } else {
                this.preview = "";
                this.shouldUpdatePreview = false;
                this.render();
            }
        } else {
            clearInterval(this.id);
        }
    }, 50);
}

const markdown = (preview) => {
    //need to sanitize the data for safety to prevent cross-scripting attacks
    //this will remove any dangerous HTML from the data before rendering it (or "executing it") 
    //because we sanitize the content, we can safely use innerHTML since this 
    //remove any malicious content that could pose cross-scripting attacks
    const sanitized = DOMPurify.sanitize(preview);
    return html`<div class="preview" innerHTML=${sanitized}> 
    </div>`
}

function startFocus() {
    this.shouldUpdatePreview = true;
    this.startPreview();
}

function stopFocus() {
    this.preview = null;
    this.render();
}

//loads some necessary state required for previewing markdown
function initalizeMarkdownPreviewVars() {
    //id representing the timer from a set interval
    this.timerID = 0;
    //boolean variable to determine whether the markdown preview needs to be updated after a keydown event
    this.shouldUpdatePreview = false;
    this.preview = null;
    this.val = "";
    this.startPreview = updateMarkdown.bind(this);
    this.stopFocus = stopFocus.bind(this);
    this.startFocus = startFocus.bind(this);
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
        this.deleteLastItem = this.deleteLastItem.bind(this);
        this.addListItem = this.addListItem.bind(this);
        this.initalizeMarkdownPreviewVars = initalizeMarkdownPreviewVars.bind(this);
        this.initalizeMarkdownPreviewVars();
        this.loading = "Hold on..."
        this.dataSource.fetch(route)
                        .then(data => {
                            const {key, rule} = data;
                            //replace in - in title with spaces to look pretty
                            this.key = key.replace("-", " ");
                            this.newItem = rule;
                            console.log(rule);
                            this.bind(this.dataSource);
                        }).catch(ex => {
                            this.loading = "This list is still waiting to get married to some data";
                            this.render();
                        });
        this.isAuthenticated = window.localStorage.getItem("authenticated");
    }

    addListItem() {
        if (!this.isAuthenticated) return;
        const sanitized = DOMPurify.sanitize(this.newItem);
        fetch("/updateList/" + this.key, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(sanitized)
        }).then(response => {
            if (response.ok) {
                return response.json()
            } else {
                return Promise.reject(response);
            }
        }).then(data => {
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
        this.shouldUpdatePreview = true;
        //combine keydown render with markdown to keep the website fast
        this.startPreview();
    }

    styles() {
        return css`
            .line {
                width: calc(100% - 0.5em);
                height: 2px;
                background: var(--fg);
                position: relative;
            }

            #add {
                opacity: ${this.isAuthenticated ? 1 : 0.2};
            }

            #add::after {
                content: ${this.isAuthenticated ? '"Add list item"' : '"Read only"'};
            }

            #delete::after {
                transform: translate(-63%, 35px);
                content: ${this.isAuthenticated ? '"Delete last"' : '"Read only"'};
            }

            #delete {
                opacity: ${this.isAuthenticated ? 1 : 0.2};
            }

            .delete {
                align-self: center;
                margin-bottom: 30px;
            }

        `
    }

    deleteLastItem() {
        if (!this.isAuthenticated) return;
        fetch("/deleteLastItem/" + this.key)
            .then(response => {
                if (response.ok) {
                    return response.json();
                } else {
                    return Promise.reject(response);
                } 
            }).then(response => {
                this.dataSource.setStore(response);
            }).catch(ex => {
                this.errorOccurred = getErrorMessageFromCode(ex.status);
                console.log("Error adding new item: ", this.errorOccurred, " ", ex);
                this.render();
            })
    }

    create() {
        if (!this.newItem) {
            console.log("hello");
            return html`<p style="margin-top: 20px;">${this.loading}</p>`;
        }
        return html`<div class="colWrapper">
             <div class="rowWrapper navHeader">
                <h1 class="title">${this.key}</h1>
                <a href="/" class="about">Home</a>
               <button id = "add" class="icon" onclick=${this.addListItem}>+</button>
             </div>
            ${this.isAuthenticated ? html`<div class = "colWrapper">
                <div class="markdown">
                    <textarea onfocus=${this.startFocus} onblur=${this.stopFocus} oninput=${this.handleKeyDown} class="highlighted littlePadding" placeholder="Define the item of your list" value=${this.newItem}></textarea>
                    <pre class="p-heights highlighted littlePadding ${this.newItem.endsWith('\n') ? 'endline' : ''}">${this.newItem}</pre>
                </div> 
                ${markdown(this.preview)} 
            </div>` : null}
            ${this.list.node}
            <button id = "delete" class = "delete icon" onclick=${this.deleteLastItem}>X</button>
        </div>
        `
    }
}

class Source extends Atom {

}

//returns a promise to get the rendered markdown of the content defined in the list component
function getMarkdownData(data) {
    if (!data) return Promise.reject(data);
    return fetch("/data", {
        method: 'POST',
        mode: 'no-cors',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    }).then(data => data.json())
      .then(data => data).catch(ex => {
          console.log("Error fetching markdown: ", ex);
      }); 
}

class HomePage extends Component {
    init(router) {
        this.router = router;
        this.text = "";
        this.password = "";
        this.id = "";
        this.data = new Source({text: "", password: "", id: ""});
        this.initalizeMarkdownPreviewVars = initalizeMarkdownPreviewVars.bind(this);
        this.initalizeMarkdownPreviewVars();
        this.errorOccurred = "";
        this.handleInputDown = this.handleInputDown.bind(this);
        this.importedMarkdown = "";
        this.handleKeyDown = (evt) => { 
            this.handleInputDown("text", evt)
            this.shouldUpdatePreview = true;
            //TODO: if this is slow on mobile, change implementation to only one render
            //markdown rendering uses a state variable this.newItem, however this component uses atomic data
            //so we need to set it before rendering the markdown
            this.newItem = evt.target.value;
            //since we bind the atomic data, this will emit an event to re-render
            //so we pass in true to `shouldNotRender` to avoid calling render twice for efficiency/speed
            this.startPreview(); 
        };
        this.handleIDInput = (evt) => this.handleInputDown("id", evt);
        this.handlePassword = (evt) => this.handleInputDown("password", evt);
        this.createList = this.createList.bind(this);
        this.closeModal = this.closeModal.bind(this);
        this.handleImportedMarkdown = this.handleImportedMarkdown.bind(this);
        this.loadView = this.loadView.bind(this);
        this.loadAbout = () => this.loadView(true);
        this.loadHome = () => this.loadView(false);
        this.bind(this.data);
    }


    handleInputDown(element, evt) {
        this.data.update({[element]: evt.target.value});
    }

    handleImportedMarkdown(evt) {
        this.importedMarkdown = evt.target.value;
        this.render();
    }

    //imports a markdown list where last item represents format
    importList() {
        var elements = this.importedMarkdown.split("-");
        const list = []
        elements.forEach(el => {
            const val = el.trim();
            if (val) {
                list.push(val);
            }
        });
        const rule = list.pop();
        this.data.update({text : rule});
        return list;
    }

    //main logic for creating a list    
    createList() {
        var listData = []
        //don't do anything if we have an empty id or if not authenticated
        if (!this.data.get("id")) return;
        if (this.importedMarkdown) {
            listData = this.importList();
        }
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
                password: this.data.get("password"),
                data: listData 
            })
        }).then(res => {
            if (res.ok) {
                //sanitize fields which get executed (markdown preview) which means we secure against risk of cross-site scripting 
                //attacks which might alter this so we can safely do this
                window.localStorage.setItem("authenticated", "true");
                //change the location of the window as opposed to just navigating ?ith the 
                //router since we need the parent component to re-render not just this one
                window.location = "/" + this.data.get("id");
            } else {
                window.localStorage.setItem("authenticated", "false");
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

            .modalContent {
                width: 300px;
                padding: 20px !important;
                margin: 0 auto;
                display: flex;
                flex-direction: column;
                border: 1px solid var(--fg);
            }

            .icon::after {
                content: 'Create a list';
            }

        `
    }

    closeModal(evt) {
        this.errorOccurred = "";
        this.render();
    }

    loadView(isAbout) {
        this.about = isAbout;
        if (isAbout) {
            this.router.navigate("/about");
        } else {
           this.router.navigate("/"); 
        }
        this.render();
    }

    create({text, password, id}) {
        const textPadding = text ? 'littlePadding' : 'extraPadding';
        return html`<div class="colWrapper">
             <div class="rowWrapper navHeader">
                <h1 class="title"><a class = "nav" href="/">Zeus</a></h1>
                <a class = "link about" onclick=${this.loadAbout}>About</a>
               <button class="icon" onclick=${this.createList}>+</button>
             </div>
             ${this.router.currentPath === "/about" ? html`<div class="colWrapper">    
                <h2>Source?</h2>
                <a class="spaceTopBottom" href="https://github.com/amirgamil/zeus">Here</a>
                <h2 class="spaceTopBottom">What is this?</h2>            
                <p class="spaceTopBottom">I (Amir) keep a lot of lists. Most of them are
                    scattered, inaccessible, slow, and hard to share. Zeus is an attempt at solving these problems 
                    by giving me an easy way to create, update, and store lists. 
                </p>
                <h2 class="spaceTopBottom">Why is this called Zeus?</h2>
                <p class="spaceTopBottom">It is an attempt at creating order from chaos. Hella melodramatic, I know.</p>
                <h2 class="spaceTopBottom">Why can I not delete items?</h2>
                <p class="spaceTopBottom">When I collect lists, I normally don't delete previous items I've collected. The focus is to 
                    capture anything interesting I come across and record it, which is why it's designed to be append only.
                    I have a delete last in case I screw up adding an item, but otherwise this is a feature not a bug.
                </p>
             </div>`: html`<div class="colWrapper">
                <form>
                    <input oninput=${this.handleIDInput} value=${id} placeholder="Enter the ID or URL of the page"/>
                    <input oninput=${this.handlePassword} value=${password} placeholder="Enter password" type="password" autocomplete="current-password"/>
                </form>
             <div class="markdown">
                <textarea onfocus=${this.startFocus} onblur=${this.stopFocus} oninput=${this.handleKeyDown} class=${textPadding} placeholder="Define what an item in your list looks like in markdown. For example: \n## Quote\nMessage\n[Link]()" value=${text}></textarea>
                <pre class="p-heights ${textPadding} ${text.endsWith("\n") ? 'endline' : ''}">${text}</pre>
             </div>
             ${markdown(this.preview)}
             <div class="markdown">
                <textarea oninput=${this.handleImportedMarkdown} class="littlePadding" placeholder="Or paste a markdown list to convert. Each list item should start with a -" value=${this.importedMarkdown}></textarea>
                <pre class="p-heights ${this.importedMarkdown.endsWith("\n") ? 'endline' : ''}">${this.importedMarkdown}</pre>
             </div>

            ${this.errorOccurred !== "" ? html`<div class = "modal"> 
                    <div class="modalContent">
                        <p>${this.errorOccurred}</p>
                        <button style="align-self: center" onclick=${this.closeModal}>x</button>
                    </div>
                </div>` : null}</div>`}
         </div>`
    }
}
class App extends Component {
    init() {
        this.list = null;
        this.router = new Router();
        this.route = "/"

        this.router.on({
            route: ["/", "/about"],
            handler: (route) => {
                this.route = route;
                this.home = new HomePage(this.router);
                this.render();
            }
        })

        this.router.on({
            route: "/:list", 
            handler: (route) => {
                this.route = route;
                this.listView = new ListView(route);
                this.render();
        }});
    }

    create() {
        const hour = new Date().getHours();
		if (hour > 19 || hour < 7) {
			document.body.classList.add('dark');
			document.documentElement.style.color = '#222';
		} else {
			document.body.classList.remove('dark');
			document.documentElement.style.color = '#fafafa';
		}
        return html`<main>
            <div class="content">
                ${() => {
                    switch (this.route) {
                        case "/":
                        case "/about":
                            return this.home.node;
                        default: 
                            //we have a list
                            return this.listView.node;
                    }
                }}
            </div>
            <footer>Built with <a class = "link" href="https://github.com/amirgamil/poseidon">Poseidon</a> by <a class = "link" href="https://amirbolous.com/">Amir</a></footer>
        </main>` 
    }
}

const app = new App();
document.body.appendChild(app.node);