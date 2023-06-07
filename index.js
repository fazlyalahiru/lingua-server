const express = require('express');
const app = express()
const cors = require('cors');
const port = process.env.PORT || 5000;

// Middleware 
app.use(express.json())
app.use(cors())

app.get('/', (req, res)=>{
    res.send('Langua server is running')
})

app.listen(port, (req, res)=>{
    console.log(`the server is running on ${port}`);
})