package lists

import (
	"bytes"
	"encoding/gob"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/gorilla/mux"
	"github.com/joho/godotenv"
	"github.com/yuin/goldmark"
)

const dbPath = "./db.gob"

//represents a stored List in our database
//our database is a serialized Go hashmap -
type List struct {
	Key  string   `json:"key"`
	Data []string `json:"data"`
	//rule represents markdown of what a unit of the list looks like
	Rule string `json:"rule"`
}

//helper struct used to represent the data in a request to create a new list
type createListRequest struct {
	Rule     string `json:"rule"`
	Password string `json:"password"`
}

type errorResponse struct {
	Message string `json:"message"`
}

//global cache representing our database
var cache map[string]*List

func check(e error) {
	if e != nil {
		panic(e)
	}
}

//create our database if it doesn't already exist
func ensureDataExists() {
	jsonFile, err := os.Open(dbPath)
	if err != nil {
		f, errCreating := os.Create(dbPath)
		if errCreating != nil {
			log.Fatal("Could not create database")
			return
		}
		f.Close()
		//write empty key "" to file to prevent errors with home page and initially populate
		//database
		addNewList("", "")
	} else {
		defer jsonFile.Close()
	}
}

func index(w http.ResponseWriter, r *http.Request) {
	indexFile, err := os.Open("./static/index.html")
	if err != nil {
		io.WriteString(w, "error reading index")
		return
	}
	defer indexFile.Close()

	io.Copy(w, indexFile)
}

//load the database into the cache
func loadCacheFromDiskToMemory() {
	//TODO: go back and check whether we can do it in one open file:
	//w. os.O_RDWR|os.O_CREATE|os.O_TRUNC
	cache = make(map[string]*List)
	gobFile, err := os.OpenFile(dbPath, os.O_RDONLY|os.O_CREATE, 0755)
	check(err)
	//use encoder/decoder to write and read from our gob file since this
	//is more memory efficient than marshalling and unmarshalling which
	//stores the entire file in memory when performing the operations
	//rather than loading line by line
	err = gob.NewDecoder(gobFile).Decode(&cache)
	gobFile.Close()
}

//writes the current cache in memory to disk i.e. saves the database for persistent storage
func writeCacheToDisk() {
	gobFile, err := os.OpenFile(dbPath, os.O_WRONLY|os.O_CREATE, 0755)
	defer gobFile.Close()
	//error may occur when reading from an empty file for the first time
	if err != nil {
		check(err)
	}
	//TODO: eventually change to file rewrite every little bit of time instead of after
	//every request
	err = gob.NewEncoder(gobFile).Encode(cache)
	check(err)
}

func addNewList(key string, rule string) {
	//create new list
	newList := List{Key: key, Data: make([]string, 0), Rule: rule}
	//TODO: eventually hash the key first and map key to hashed string
	cache[key] = &newList
	fmt.Println(cache[key])
	writeCacheToDisk()
}

func createList(w http.ResponseWriter, r *http.Request) {
	var request createListRequest
	err := json.NewDecoder(r.Body).Decode(&request)
	check(err)
	vars := mux.Vars(r)
	listKey := vars["listName"]
	w.Header().Set("Content-Type", "application/json")
	//check for valid password, otherwise return an error
	if !isValidPassword(request.Password) {
		//return unauthorized header
		w.WriteHeader(http.StatusUnauthorized)
	} else if keyExists(listKey) {
		w.WriteHeader(http.StatusMethodNotAllowed)
	} else {
		addNewList(listKey, request.Rule)
	}
}

func getMarkdownFromString(source string) string {
	var buf bytes.Buffer
	if err := goldmark.Convert([]byte(source), &buf); err != nil {
		panic(err)
	}
	return buf.String()
}

func parseMarkdown(w http.ResponseWriter, r *http.Request) {
	var source string
	err := json.NewDecoder(r.Body).Decode(&source)
	check(err)
	//convert string to markdown
	markDown := getMarkdownFromString(source)
	json.NewEncoder(w).Encode(markDown)
}

func getList(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	listKey := vars["listName"]
	fmt.Println(cache[listKey])
	//TODO: map to hash
	json.NewEncoder(w).Encode(cache[listKey])
}

func (list *List) addItemToList(item string) {
	fmt.Println(list.Data)
	list.Data = append(list.Data, item)
}

func updateList(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	listKey := vars["listName"]
	if !keyExists(listKey) {
		w.WriteHeader(http.StatusMethodNotAllowed)
	} else {
		var data string
		err := json.NewDecoder(r.Body).Decode(&data)
		check(err)
		list := cache[listKey]
		//update data in our cache
		newListItem := getMarkdownFromString(data)
		list.addItemToList(newListItem)
		fmt.Println(list.Data)
		writeCacheToDisk()
		//return new appended data - client will add to the store
		//prevents us having to constantly reload the entire list, faster/more efficient this way
		json.NewEncoder(w).Encode(newListItem)
	}
}

func deleteLastItem(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	listKey := vars["listName"]
	list := cache[listKey]
	if !keyExists(listKey) || !keyExists(listKey) || len(list.Data) == 0 {
		w.WriteHeader(http.StatusMethodNotAllowed)
	} else {
		list.Data = list.Data[:len(list.Data)-1]
		json.NewEncoder(w).Encode(list.Data)
	}
}

func isValidPassword(password string) bool {
	err := godotenv.Load()
	check(err)
	truePass := os.Getenv("PASSWORD")
	fmt.Println(truePass, password)
	return truePass == password
}

//function which returns whether a key exists in our database
func keyExists(key string) bool {
	_, ok := cache[key]
	return ok
}

func Start() {
	ensureDataExists()
	//TODO: eventually change to load certain parts in memory, no need for the entire cache
	loadCacheFromDiskToMemory()
	r := mux.NewRouter()

	srv := &http.Server{
		Handler:      r,
		Addr:         "127.0.0.1:8994",
		WriteTimeout: 60 * time.Second,
		ReadTimeout:  60 * time.Second,
	}

	r.Methods("POST").Path("/createList/{listName}").HandlerFunc(createList)
	r.Methods("GET").Path("/getList/{listName}").HandlerFunc(getList)
	r.Methods("POST").Path("/updateList/{listName}").HandlerFunc(updateList)
	r.Methods("GET").Path("/deleteLastItem/{listName}").HandlerFunc(deleteLastItem)
	r.Methods("POST").Path("/data").HandlerFunc(parseMarkdown)
	r.PathPrefix("/static/").Handler(http.StripPrefix("/static/", http.FileServer(http.Dir("./static"))))
	//match all other routes here, routing will be handled on the client side
	r.PathPrefix("/").HandlerFunc(index)
	log.Printf("Server listening on %s\n", srv.Addr)
	log.Fatal(srv.ListenAndServe())

}
