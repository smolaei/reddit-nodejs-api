var bcrypt = require('bcrypt');
var HASH_ROUNDS = 10;

module.exports = function RedditAPI(conn) {
  return {
    createUser: function(user, callback) {

      // first we have to hash the password...
      bcrypt.hash(user.password, HASH_ROUNDS, function(err, hashedPassword) {
        if (err) {
          callback(err);
        }
        else {
          conn.query(
            'INSERT INTO users (username,password, createdAt) VALUES (?, ?, ?)', [user.username, hashedPassword, new Date()],
            function(err, result) {
              if (err) {
                /*
                There can be many reasons why a MySQL query could fail. While many of
                them are unknown, there's a particular error about unique usernames
                which we can be more explicit about!
                */
                if (err.code === 'ER_DUP_ENTRY') {
                  callback(new Error('A user with this username already exists'));
                }
                else {
                  callback(err);
                }
              }
              else {
                /*
                Here we are INSERTing data, so the only useful thing we get back
                is the ID of the newly inserted row. Let's use it to find the user
                and return it
                */
                conn.query(
                  'SELECT id, username, createdAt, updatedAt FROM users WHERE id = ?', [result.insertId],
                  function(err, result) {
                    if (err) {
                      callback(err);
                    }
                    else {
                      /*
                      Finally! Here's what we did so far:
                      1. Hash the user's password
                      2. Insert the user in the DB
                      3a. If the insert fails, report the error to the caller
                      3b. If the insert succeeds, re-fetch the user from the DB
                      4. If the re-fetch succeeds, return the object to the caller
                      */
                      callback(null, result[0]);
                    }
                  }
                );
              }
            }
          );
        }
      });
    },
    createPost: function(post, subredditId, callback) {
      if (!subredditId) {
        console.log("subreddit is required")
      }

      conn.query(
        `INSERT INTO posts (userId, title, url, createdAt, subredditId) 
        VALUES (?, ?, ?, ?, ?)`, [post.userId, post.title, post.url, new Date(), subredditId],
        function(err, result) {
          if (err) {
            callback(err);
          }
          else {
            /*
            Post inserted successfully. Let's use the result.insertId to retrieve
            the post and send it to the caller!
            */
            conn.query(
              `SELECT id,title,url,userId, createdAt, updatedAt, subredditId 
               FROM posts 
               WHERE id = ?`, [result.insertId],
              function(err, result) {
                if (err) {
                  callback(err);
                }
                else {
                  callback(null, result[0]);
                }
              }
            );
          }
        }
      );
    },
    getAllPosts: function(options, callback) {
      // In case we are called without an options parameter, shift all the parameters manually
      if (!callback) {
        callback = options;
        options = {};
      }
      var limit = options.numPerPage || 25; // if options.numPerPage is "falsy" then use 25
      var offset = (options.page || 0) * limit;

      conn.query(`
        SELECT p.id AS postId, 
        p.title, p.url, 
        p.createdAt AS postCreatedAt, 
        p.updatedAt AS postUpdatedAt, 
        u.id AS usernameId, 
        u.username, 
        u.createdAt AS userCreatedAt, 
        u.updatedAt AS userUpdatedAt, 
        s.id AS subredditId, 
        s.name AS subredditName, 
        s.description AS subredditDescription, 
        s.createdAt AS subredditCreatedAt, 
        s.updatedAt AS subredditUpdatedAt,
           SUM(v.vote) as voteScore,
           (SUM(v.vote))*100000000/(now() - p.createdAt) as hottest,
           COUNT(*) as totalVotes,
           SUM(IF(v.vote = 1, 1, 0)) AS numUpVotes,
           SUM(IF(v.vote = -1, 1, 0)) AS numDownVotes,
           CASE 
            WHEN SUM(IF(v.vote = 1, 1, 0)) < SUM(IF(v.vote = -1, 1,0)) 
               THEN COUNT(*) * SUM(IF(v.vote = -1, 1,0)) / SUM(IF(v.vote = 1, 1,0))
               ELSE COUNT(*) * SUM(IF(v.vote = 1, 1,0)) / SUM(IF(v.vote = -1, 1,0))
            END AS controversialRanking
          FROM posts AS p
          JOIN users AS u ON u.id = p.userId
          JOIN subreddit AS s ON s.id = p.subredditId
          JOIN votes AS v ON p.id = v.postId
          GROUP BY postId
          ORDER BY postCreatedAt DESC`, [limit, offset],
        function(err, results) {
          if (err) {
            callback(err);
          }
          else {
            var formatedResults = results.map(function(value) {
              return {
                post: {
                  id: value.postId,
                  title: value.title,
                  url: value.url,
                  createdAt: value.postCreatedAt,
                  updatedAt: value.postUpdatedAt,
                },
                user: {
                  userId: value.usernameId,
                  username: value.username,
                  createdAt: value.userCreatedAt,
                  updatedAt: value.userUpdatedAt,

                },
                subreddit: {
                  subredditId: value.subredditId,
                  Name: value.subredditName,
                  description: value.subredditDescription,
                  createdAt: value.subredditCreatedAt,
                  updatedAt: value.subredditUpdatedAt
                },
                voteScore: value.voteScore,
                numUpVotes: value.numUpVotes,
                numDownVotes: value.numDownVotes,
                totalVotes: value.totalVotes,
                hotnessRanking: value.hottest,
                controversialRanking: value.controversialRanking,
              }
            })
            callback(null, formatedResults);
          }
        }
      );
    },
    getAllPostsForUser: function(userId, options, callback) {
      if (!callback) {
        callback = options;
        options = {};
      }
      var limit = options.numPerPage || 25; // if options.numPerPage is "falsy" then use 25
      var offset = (options.page || 0) * limit;

      conn.query(`
        SELECT *
        FROM posts
        JOIN users
        ON (users.id = posts.userId) where userId=?`, [userId, limit, offset],
        function(err, results) {
          if (err) {
            callback(err);
          }
          else {

            var formatedResults = results.map(function(value) {
              return {
                id: value.id,
                title: value.title,
                url: value.url,
                createdAt: value.createdAt,
                updatedAt: value.updatedAt,
              }
            })
            callback(null, results);
          }
        }
      );
    },
    getSinglePost: function(postId, callback) {
      conn.query(
        `SELECT id,title,url,userId, createdAt, updatedAt 
          FROM posts 
          WHERE posts.id = ?`, [postId],
        function(err, result) {
          if (err) {
            callback(err);
          }
          else {
            var formatedResults = result.map(function(value) {
              return {
                id: value.id,
                title: value.title,
                url: value.url,
                createdAt: value.createdAt,
                updatedAt: value.updatedAt,
              }
            })
            callback(null, formatedResults)
          }
        }
      );
    },
    createSubreddit: function(sub, callback) {
      if (!sub || !sub.name) {
        callback(new Error('name is mandatory'));
        return;
      }
      conn.query(
        `INSERT INTO subreddit (id, name, description, createdAt,updatedAt)
         VALUES (?, ?, ?, ?, ?)`, [sub.id, sub.name, sub.description, new Date(), new Date()],
        function(err, result) {
          if (err) {
            callback(err);
          }
          else {
            /*
            Post inserted successfully. Let's use the result.insertId to retrieve
            the post and send it to the caller!
            */
            conn.query(
              `SELECT id,title,url,userId, createdAt, updatedAt 
               FROM posts 
               WHERE id = ?`, [result.insertId],
              function(err, result) {
                if (err) {
                  callback(err);
                }
                else {
                  callback(null, result[0]);
                }
              }
            );
          }
        }
      );
    },
    getAllSubreddits: function(callback) {
      conn.query(`
      SELECT id,
          name,
          description,
          createdAt,
          updatedAt
        FROM subreddit
        ORDER BY createdAt DESC`, function(err, result) {
        if (err) {
          callback(err);
        }
        else {
          var formatedResults = result.map(function(ele) {
            return {
              id: ele.id,
              name: ele.name,
              description: ele.description,
              createdAt: ele.createdAt,
              updatedAt: ele.updatedAt
            }
          })
          callback(null, formatedResults);
        }
      });
    },
    createOrUpdateVote: function(vote, callback) {
      if (vote.vote === -1 || vote.vote === 0 || vote.vote === 1) {
        console.log("You have voted " + vote.vote + " for this post");
        conn.query(
          `INSERT INTO votes (postId, userId, vote, createdAt)
          VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE vote = ?, updatedAt = ?`, [vote.postId, vote.userId, vote.vote, new Date(), vote.vote, new Date()],
          function(err, result) {
            if (err) {
              callback(err);
            }
            else {
              conn.query(
                `SELECT * FROM votes`,
                function(err, result) {
                  if (err) {
                    callback(err);
                  }
                  else {
                    callback(null, result);
                  }
                }
              );
            }
          });
      }
      else {
        callback('Vote has to be equal to 0,1 or -1');
      }
    }
  }
}
