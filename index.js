const express = require('express');
const app = express()
const cors = require('cors');
require('dotenv').config()
const port = process.env.PORT || 5000;
const { ObjectId } = require('mongodb');
const { MongoClient, ServerApiVersion } = require('mongodb');

// Middleware 
app.use(express.json())
app.use(cors())

//MongoDB starts here


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ywgzzs0.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        const usersCollenction = client.db('linguaDb').collection('users')
        const classCollection = client.db('linguaDb').collection('classes')
        const enrollCollection = client.db('linguaDb').collection('enrolls')

        // save user in database
        app.put('/users/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const query = { email: email }
            const options = { upsert: true }
            const updateDoc = {
                $set: user
            }
            const result = await usersCollenction.updateOne(query, updateDoc, options)

            res.send(result)
        })

        // find the role of a user
        app.get('/users/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email }
            const result = await usersCollenction.findOne(query);
            res.send(result)
        })

        // Add a class to mongodb 
        app.post('/classes', async (req, res) => {
            const classInfo = req.body;

            const result = await classCollection.insertOne(classInfo)
            res.send(result)
        })

        // find all classes
        app.get('/classes', async (req, res) => {
            const result = await classCollection.find().toArray()
            res.send(result)
        })

        // save enrolled class info
        app.post('/enrolls', async (req, res) => {
            const enrollInfo = req.body;
            const uniqueId = new ObjectId();
            enrollInfo._id = uniqueId;

            const existingEnrollment = await enrollCollection.findOne(
                {
                    classId: enrollInfo.classId,
                    "userInfo.email": enrollInfo.userInfo.email
                }

            );

            if (existingEnrollment) {
                res.status(400).json({ error: 'You have already enrolled for this class.' });
                console.log("Card already enrolled:", existingEnrollment);
            } else {
                const result = await enrollCollection.insertOne(enrollInfo)
                res.status(200).json(result);
            }

        })

        // Get all enrolls by email
        app.get('/enrolls', async (req, res) => {
            const email = req.query.email;
            if (!email) {
                res.send([])
            }
            const query = { "userInfo.email": email }
            const result = await enrollCollection.find(query).toArray()
            res.send(result)
        })


        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();
        // Send a ping to confirm a successful connection
        client.db("admin").command({ ping: 1 });
        console.log("Amazing! you just hit the MongoDB");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);

// MongoDB ends here
app.get('/', (req, res) => {
    res.send('Langua server is running')
})

app.listen(port, (req, res) => {
    console.log(`the server is running on ${port}`);
})