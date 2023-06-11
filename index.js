const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.port || 5000;

// middleware
app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({error: true, message: 'unauthorized access'})
  }
  // bearer token
  const token = authorization.split(' ')[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded)=> {
    if(err){
      return res.status(401).send({error: true, message: 'unauthorized access'})
    }
    req.decoded = decoded;
    next();
  })
}


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ekmhdar.mongodb.net/?retryWrites=true&w=majority`;

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
    // Connect the client to the server	(optional starting in v4.7)
    client.connect();

    const usersCollection = client.db('sportWingDb').collection('users');
    const classCollection = client.db('sportWingDb').collection('classes');
    const bookedCollection = client.db('sportWingDb').collection('bookedClass');


    app.post('/jwt', (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {expiresIn: '5h'});
      res.send({ token });
    })

    // use verifyJWT before using verifyAdmin
    const verifyAdmin = async(req, res, next) => {
      const email = req.decoded.email;
      const query = {email: email}
      const user = await usersCollection.findOne(query);
      if(user?.role !== 'admin') {
        return res.status(403).send({error: true, message: 'forbidden message'})
      }
      next();
    }

    const verifyInstructor = async(req, res, next) => {
      const email = req.decoded.email;
      const query = {email: email}
      const user = await usersCollection.findOne(query);
      if(user?.role !== 'instructor') {
        return res.status(403).send({error: true, message: 'forbidden message'})
      }
      next();
    }


    app.post('/bookedClass', async(req,res) => {
      const item = req.body;
      const result = await bookedCollection.insertOne(item)
      res.send(result);
    })


    // users related apis

    app.get('/users', async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    })
    
    app.post('/users', async(req, res) => {
      const user = req.body;
      // console.log(user);
      const query = {email: user.email};
      const existingUser = await usersCollection.findOne(query);
      // console.log('existing user', existingUser);
      if(existingUser){
        return res.send({message: 'User Already Exists'})
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    })

    app.get('/users/admin/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;

      if(req.decoded.email !== email) {
        res.send ({admin: false})
      }
      const query = {email: email}
      const user = await usersCollection.findOne(query);
      const result = { admin: user?.role === 'admin'}
      res.send(result)
    })


    app.patch('/users/admin/:id', async(req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id)};
      const updateDoc = {
        $set: {
          role: 'admin'
        },
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result)
    })


    app.get('/users/instructor/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;

      if(req.decoded.email !== email) {
        res.send ({instructor: false})
      }
      const query = {email: email}
      const user = await usersCollection.findOne(query);
      const result = { instructor: user?.role === 'instructor'}
      res.send(result)
    })


    app.patch('/users/instructor/:id', async(req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id)};
      const updateDoc = {
        $set: {
          role: 'instructor'
        },
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result)
    })

    app.post('/classes', async(req, res) => {
      const newClass = req.body;
      const result = await classCollection.insertOne(newClass);
      res.send(result);
    })

    app.get('/classes', async (req, res) => {
      const result = await classCollection.find().toArray();
      res.send(result);
    })


    app.patch('/classes/:id', verifyJWT, verifyAdmin, async (req, res) => {
      try {
        const { id } = req.params;
        const { status } = req.body;
    
        const filter = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: { status },
        };
    
        const result = await classCollection.updateOne(filter, updateDoc);
        res.send(result);
      } catch (error) {
        console.error("Error updating class status:", error);
        res.status(500).send({ error: true, message: "Failed to update class status" });
      }
    });


    app.post("/feedback", verifyJWT, async (req, res) => {
      try {
        const { classId, feedback } = req.body;
    
        const filter = { _id: new ObjectId(classId) };
        const updateDoc = {
          $set: { feedback },
        };
        const result = await classCollection.updateOne(filter, updateDoc);
    
        res.send(result);
      } catch (error) {
        console.error("Error submitting feedback:", error);
        res.status(500).send({ error: "Failed to submit feedback" });
      }
    });


    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);



app.get('/', (req, res) => {
    res.send('SportWing is Running')
})

app.listen(port, ()=> {
    console.log(`SportWing is Running on Port: ${port}`);
})