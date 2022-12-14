const { gql, UserInputError, AuthenticationError } = require("apollo-server-express");
const { isAuthenticated } = require("../validators/auth");

const typeDefs = gql`
    type Log{
        id: ID!
        timestamp: String!
        user_id: ID
        user_name: String
        message: String!
        type: String!
    }
    type Notification{
        id: ID
        user_id: ID
        message: String
        createdat: String
    }
    extend type Query {
        getLogs: [Log]!
        getLogsByDate(date:String!): [Log]
        getLogsByMonth(year_month:String!): [Log]
        getLogsByYear(year:String!): [Log]
        getNotifications(user_id:ID!): [Notification]
    }
`
const resolvers = {
    Query: {
        async getLogs(_, args, { dataSources }, info) {
            try {
                return (await dataSources.logsAPI.getLogs()).data;
            } catch (error) {
                throw new Error(error);
            }
        },
        async getLogsByDate(_, args, { dataSources }, info) {
            try {
                const date = args.date.split("/");
                return (await dataSources.logsAPI.getLogsByDate(date[0],date[1],date[2])).data;
            } catch (error) {
                throw new Error(error);
            }
        },
        async getLogsByMonth(_, args, { dataSources }, info) {
            try {
                const date = args.year_month.split("/");
                return (await dataSources.logsAPI.getLogsByMonth(date[0],date[1])).data;
            } catch (error) {
                throw new Error(error);
            }
        },
        async getLogsByYear(_, args, { dataSources }, info) {
            try {
                return (await dataSources.logsAPI.getLogsByYear(args.year)).data;
            } catch (error) {
                throw new Error(error);
            }
        },
        async getNotifications(_, args, { dataSources }, info) {
            try {
                return (await dataSources.logsAPI.getNotifications(args.user_id)).data;
            } catch (error) {
                throw new Error(error);
            }
        }
    },
}
module.exports = {typeDefs, resolvers};